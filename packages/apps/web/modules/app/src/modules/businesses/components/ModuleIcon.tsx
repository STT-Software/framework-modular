import type { ModuleInfo } from "../catalog";

/** The colored icon of a module. The inner SVG comes from the catalog, never from user input. */
export function ModuleIcon({ module }: { module: ModuleInfo }) {
  return (
    <span className="bs-module-icon" data-color={module.color} aria-hidden="true">
      <svg viewBox="0 0 24 24" dangerouslySetInnerHTML={{ __html: module.icon }} />
    </span>
  );
}
