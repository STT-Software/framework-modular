import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, it } from 'node:test';

/**
 * Architecture rules of the backend, checked against the real imports of the code:
 *
 *  1. platform/ never depends on modules/.
 *  2. A module reaches another one only through `modules/<other>/public.ts`, never its internals
 *     (repositories, schemas, controllers...). The application root (app.module.ts) follows the same rule.
 *  3. Layers inside a module: domain <- application <- api, and domain <- infrastructure.
 *     The domain knows nothing about the others; application and api never touch infrastructure.
 *  4. Persistence (mongoose) lives in infrastructure and in the module files that declare collections;
 *     tokens (@nestjs/jwt) live only in platform/security.
 *  5. No import cycles, between files or between modules.
 */

const SRC = resolve(__dirname);

type Zone =
  | { kind: 'platform'; area: string }
  | { kind: 'module'; module: string; layer: 'domain' | 'application' | 'api' | 'infrastructure' | 'root' }
  | { kind: 'app' };

interface Edge {
  from: string; // path relative to src, with "/" separators
  to: string | null; // internal target (relative to src) or null for a package
  specifier: string;
}

function posix(path: string): string {
  return path.split(sep).join('/');
}

function zoneOf(file: string): Zone {
  const parts = file.split('/');
  if (parts[0] === 'platform') return { kind: 'platform', area: parts[1] ?? '' };
  if (parts[0] === 'modules' && parts.length >= 3) {
    const layers = ['domain', 'application', 'api', 'infrastructure'] as const;
    const layer = layers.find((l) => l === parts[2]);
    return { kind: 'module', module: parts[1], layer: layer ?? 'root' };
  }
  return { kind: 'app' };
}

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [posix(relative(SRC, path))] : [];
  });
}

const IMPORT_PATTERNS = [
  /\b(?:import|export)\b[^;'"`]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
];

function readEdges(files: string[]): Edge[] {
  const known = new Set(files);
  return files.flatMap((from) => {
    // Comments are removed first: a word like "import" in a doc comment must never count as a dependency.
    const text = readFileSync(join(SRC, from), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const specifiers = IMPORT_PATTERNS.flatMap((pattern) => [...text.matchAll(pattern)].map((m) => m[1]));
    return specifiers.map((specifier): Edge => {
      if (!specifier.startsWith('.')) return { from, to: null, specifier };
      const base = posix(relative(SRC, resolve(dirname(join(SRC, from)), specifier)));
      const to = [`${base}.ts`, `${base}/index.ts`].find((candidate) => known.has(candidate)) ?? null;
      return { from, to, specifier };
    });
  });
}

/** Every rule in one pure function, so it can also be tested against made-up violations. */
export function findViolations(edges: Edge[]): string[] {
  const violations: string[] = [];
  const say = (edge: Edge, rule: string) => violations.push(`${edge.from} -> ${edge.to ?? edge.specifier}: ${rule}`);

  for (const edge of edges) {
    const source = zoneOf(edge.from);

    if (edge.to === null) {
      // Packages.
      const isMongoose = edge.specifier === 'mongoose' || edge.specifier === '@nestjs/mongoose';
      const mayUseMongoose =
        (source.kind === 'module' && (source.layer === 'infrastructure' || edge.from.endsWith('.module.ts'))) ||
        (source.kind === 'platform' && source.area === 'database');
      if (isMongoose && !mayUseMongoose) say(edge, 'mongoose only in infrastructure, module files and platform/database');
      if (edge.specifier === '@nestjs/jwt' && !(source.kind === 'platform' && source.area === 'security')) {
        say(edge, '@nestjs/jwt only in platform/security');
      }
      continue;
    }

    const target = zoneOf(edge.to);

    if (source.kind === 'platform' && target.kind !== 'platform') {
      say(edge, 'platform must not depend on modules or the app');
    }

    if (target.kind === 'module' && (source.kind !== 'module' || source.module !== target.module)) {
      if (!edge.to.endsWith(`modules/${target.module}/public.ts`)) {
        say(edge, `use modules/${target.module}/public.ts, not its internals`);
      }
    }

    if (source.kind === 'module' && target.kind === 'module' && source.module === target.module) {
      const allowed: Record<string, string[]> = {
        domain: ['domain'],
        application: ['domain', 'application'],
        api: ['domain', 'application', 'api'],
        infrastructure: ['domain', 'infrastructure'],
        root: ['domain', 'application', 'api', 'infrastructure', 'root'],
      };
      if (!allowed[source.layer].includes(target.layer)) {
        say(edge, `layer ${source.layer} must not depend on ${target.layer}`);
      }
    }

    if (source.kind === 'module' && source.layer === 'domain' && target.kind === 'platform' && target.area !== 'errors') {
      say(edge, 'the domain may only use platform/errors');
    }
  }
  return violations;
}

/** The first import cycle found in a graph, as a readable path, or null. */
export function findCycle(graph: Map<string, Set<string>>): string | null {
  const state = new Map<string, 'visiting' | 'done'>();
  const stack: string[] = [];
  const visit = (node: string): string | null => {
    state.set(node, 'visiting');
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      if (state.get(next) === 'visiting') return [...stack.slice(stack.indexOf(next)), next].join(' -> ');
      if (!state.has(next)) {
        const cycle = visit(next);
        if (cycle) return cycle;
      }
    }
    stack.pop();
    state.set(node, 'done');
    return null;
  };
  for (const node of graph.keys()) {
    if (!state.has(node)) {
      const cycle = visit(node);
      if (cycle) return cycle;
    }
  }
  return null;
}

function fileGraph(edges: Edge[], files: string[]): Map<string, Set<string>> {
  const graph = new Map(files.map((file) => [file, new Set<string>()]));
  for (const edge of edges) if (edge.to) graph.get(edge.from)!.add(edge.to);
  return graph;
}

function moduleGraph(edges: Edge[], modules: string[]): Map<string, Set<string>> {
  const graph = new Map(modules.map((m) => [m, new Set<string>()]));
  for (const edge of edges) {
    const from = zoneOf(edge.from);
    const to = edge.to ? zoneOf(edge.to) : null;
    if (from.kind === 'module' && to?.kind === 'module' && from.module !== to.module) {
      graph.get(from.module)!.add(to.module);
    }
  }
  return graph;
}

const files = listSourceFiles(SRC);
const edges = readEdges(files);
const modules = readdirSync(join(SRC, 'modules')).filter((name) => statSync(join(SRC, 'modules', name)).isDirectory());

describe('backend architecture', () => {
  it('sees the real code (the checks below are not vacuous)', () => {
    assert.ok(files.length > 20, `only ${files.length} files found`);
    assert.ok(edges.some((edge) => edge.to !== null));
    assert.deepEqual([...modules].sort(), ['auth', 'onboarding']);
  });

  it('every module has an explicit public door and a module file', () => {
    for (const name of modules) {
      assert.ok(existsSync(join(SRC, 'modules', name, 'public.ts')), `${name}: missing public.ts`);
      assert.ok(existsSync(join(SRC, 'modules', name, `${name}.module.ts`)), `${name}: missing ${name}.module.ts`);
    }
  });

  it('respects the module boundaries, the layers and where persistence and tokens may live', () => {
    assert.deepEqual(findViolations(edges), []);
  });

  it('has no import cycles between files', () => {
    assert.equal(findCycle(fileGraph(edges, files)), null);
  });

  it('has no dependency cycles between modules', () => {
    assert.equal(findCycle(moduleGraph(edges, modules)), null);
  });

  it('has no empty layer folders', () => {
    for (const name of modules) {
      for (const layer of ['api', 'application', 'domain', 'infrastructure']) {
        const dir = join(SRC, 'modules', name, layer);
        if (existsSync(dir)) assert.ok(listSourceFiles(dir).length > 0, `${name}/${layer} is empty`);
      }
    }
  });
});

describe('the rules detect violations', () => {
  const edge = (from: string, to: string | null, specifier = to ?? 'pkg'): Edge => ({ from, to, specifier });

  it('flags reaching into the internals of another module', () => {
    const found = findViolations([
      edge('modules/onboarding/application/x.ts', 'modules/auth/infrastructure/mongo-super-admin.repository.ts'),
      edge('app.module.ts', 'modules/auth/auth.module.ts'),
    ]);
    assert.equal(found.length, 2);
  });

  it('allows another module and the app to use the public door', () => {
    assert.deepEqual(
      findViolations([
        edge('modules/onboarding/application/x.ts', 'modules/auth/public.ts'),
        edge('app.module.ts', 'modules/auth/public.ts'),
      ]),
      [],
    );
  });

  it('flags the platform depending on a module, and a leaky domain or application layer', () => {
    const found = findViolations([
      edge('platform/security/x.ts', 'modules/auth/public.ts'),
      edge('modules/auth/domain/x.ts', 'modules/auth/infrastructure/y.ts'),
      edge('modules/auth/domain/x.ts', 'platform/security/token.service.ts'),
      edge('modules/auth/application/x.ts', 'modules/auth/infrastructure/y.ts'),
      edge('modules/auth/api/x.ts', 'modules/auth/infrastructure/y.ts'),
      edge('modules/auth/application/x.ts', null, 'mongoose'),
      edge('modules/auth/api/x.ts', null, '@nestjs/jwt'),
    ]);
    assert.equal(found.length, 7);
  });

  it('finds a cycle', () => {
    const graph = new Map([
      ['a', new Set(['b'])],
      ['b', new Set(['c'])],
      ['c', new Set(['a'])],
    ]);
    assert.equal(findCycle(graph), 'a -> b -> c -> a');
  });
});
