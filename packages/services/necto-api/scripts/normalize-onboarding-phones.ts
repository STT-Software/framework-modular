/**
 * Migration: rewrites every `phone` of `onboarding_profiles` in its canonical E.164 form, with the same function the
 * API uses (`normalizePhoneNumber`), so the unique index on `phone` compares canonical forms from now on.
 *
 * Usage (from packages/services/necto-api, reads MONGODB_URI from the environment or from `.env`):
 *
 *   npm run migrate:phones              dry run: reports what it would do and writes nothing
 *   npm run migrate:phones -- --apply   writes the changes
 *
 * - Idempotent: a phone that is already canonical is left alone, so it can run again at any time. Run it after the
 *   deployment and a second time later, to catch what the old API wrote in between.
 * - Never merges accounts. When two profiles become the same number (or one already holds it), none of them is
 *   rewritten and the group is reported as a collision; MongoDB rejecting a write with error 11000 (someone saved
 *   that number meanwhile) is reported the same way. A person decides which account keeps the number.
 * - Numbers that are not a valid mobile number with country code are reported and left as they are.
 * - Phones are masked in the output; profiles are identified by `userId`.
 *
 * It lives outside `src/` because it is an operations tool, not part of the API (and `architecture.spec.ts` keeps
 * mongoose out of the domain). Exit code: 0 when nothing needs a person, 2 when there are collisions or unparseable
 * numbers, 1 on a failure.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import mongoose from 'mongoose';
import { normalizePhoneNumber } from '../src/modules/onboarding/domain/phone-number';

export const COLLECTION = 'onboarding_profiles';

/** What the script reads of each profile. `phone` is whatever is stored, which may not even be a string. */
export interface StoredProfile {
  id: string;
  userId: string;
  phone: unknown;
}

export interface PhoneUpdate {
  id: string;
  userId: string;
  from: string;
  to: string;
}

export interface PhoneCollision {
  /** The canonical number several profiles would share. */
  phone: string;
  /** Every profile involved, including the one that may already hold the canonical form. */
  profiles: { id: string; userId: string; stored: string }[];
}

export interface PhoneMigrationPlan {
  updates: PhoneUpdate[];
  /** Profiles whose phone is already canonical and are not part of a collision. */
  unchanged: number;
  collisions: PhoneCollision[];
  unparseable: { id: string; userId: string; stored: unknown }[];
}

/** Decides what to do with every profile, without touching the database. Pure, so it is tested on its own. */
export function planPhoneMigration(profiles: readonly StoredProfile[]): PhoneMigrationPlan {
  const plan: PhoneMigrationPlan = { updates: [], unchanged: 0, collisions: [], unparseable: [] };
  const byCanonical = new Map<string, { profile: StoredProfile; stored: string }[]>();

  for (const profile of profiles) {
    const canonical = normalizePhoneNumber(profile.phone);
    if (canonical === null || typeof profile.phone !== 'string') {
      plan.unparseable.push({ id: profile.id, userId: profile.userId, stored: profile.phone });
      continue;
    }
    const group = byCanonical.get(canonical) ?? [];
    group.push({ profile, stored: profile.phone });
    byCanonical.set(canonical, group);
  }

  for (const [canonical, group] of byCanonical) {
    if (group.length > 1) {
      plan.collisions.push({
        phone: canonical,
        profiles: group.map(({ profile, stored }) => ({ id: profile.id, userId: profile.userId, stored })),
      });
      continue;
    }
    const [{ profile, stored }] = group;
    if (stored === canonical) {
      plan.unchanged++;
    } else {
      plan.updates.push({ id: profile.id, userId: profile.userId, from: stored, to: canonical });
    }
  }
  return plan;
}

/** "+573001234567" -> "+57*******567": enough to tell numbers apart in a report without printing them. */
export function maskPhone(value: unknown): string {
  if (typeof value !== 'string') return `<${value === null ? 'null' : typeof value}>`;
  const text = value.trim();
  if (text.length <= 6) return '*'.repeat(text.length);
  return `${text.slice(0, 3)}${'*'.repeat(text.length - 6)}${text.slice(-3)}`;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 11000;
}

function loadMongoUri(): string {
  const envFile = resolve(__dirname, '..', '.env');
  if (!process.env.MONGODB_URI && existsSync(envFile)) process.loadEnvFile(envFile);
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set (environment or packages/services/necto-api/.env)');
  return uri;
}

async function main(): Promise<number> {
  const apply = process.argv.includes('--apply');
  const unknown = process.argv.slice(2).filter((arg) => arg !== '--apply');
  if (unknown.length > 0) {
    console.error(`Unknown arguments: ${unknown.join(' ')}. The only option is --apply.`);
    return 1;
  }

  await mongoose.connect(loadMongoUri());
  try {
    const collection = mongoose.connection.collection(COLLECTION);
    const docs = await collection.find({}, { projection: { _id: 1, userId: 1, phone: 1 } }).toArray();
    const idsByText = new Map(docs.map((doc) => [String(doc._id), doc._id]));
    const plan = planPhoneMigration(
      docs.map((doc) => ({ id: String(doc._id), userId: String(doc.userId), phone: doc.phone })),
    );

    console.log(`${apply ? 'APPLY' : 'DRY RUN (nothing is written; add --apply to write)'} on ${COLLECTION}`);
    console.log(`Profiles read: ${docs.length}. Already canonical: ${plan.unchanged}. To rewrite: ${plan.updates.length}.`);

    let written = 0;
    const lateCollisions: PhoneUpdate[] = [];
    for (const update of plan.updates) {
      const line = `  ${update.userId}: ${maskPhone(update.from)} -> ${maskPhone(update.to)}`;
      if (!apply) {
        console.log(`${line} (would rewrite)`);
        continue;
      }
      try {
        // Matching on the old value too: if the profile changed since it was read, it is left for the next run.
        const result = await collection.updateOne(
          { _id: idsByText.get(update.id), phone: update.from },
          { $set: { phone: update.to } },
        );
        if (result.modifiedCount === 1) {
          written++;
          console.log(`${line} (rewritten)`);
        } else {
          console.log(`${line} (skipped: the profile changed since it was read; run again)`);
        }
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        lateCollisions.push(update);
        console.log(`${line} (collision 11000: another profile holds that number now; not merged)`);
      }
    }

    if (plan.collisions.length > 0) {
      console.log(`Collisions (not rewritten, not merged; a person decides which account keeps the number): ${plan.collisions.length}`);
      for (const collision of plan.collisions) {
        console.log(`  ${maskPhone(collision.phone)}:`);
        for (const profile of collision.profiles) console.log(`    ${profile.userId} stores ${maskPhone(profile.stored)}`);
      }
    }
    if (plan.unparseable.length > 0) {
      console.log(`Not a valid mobile number with country code (left as is): ${plan.unparseable.length}`);
      for (const profile of plan.unparseable) console.log(`  ${profile.userId} stores ${maskPhone(profile.stored)}`);
    }
    if (apply) console.log(`Rewritten: ${written}.`);

    return plan.collisions.length + lateCollisions.length + plan.unparseable.length > 0 ? 2 : 0;
  } finally {
    await mongoose.disconnect();
  }
}

// Runs only as a script; importing it (from its spec) just exposes the pure functions.
if (require.main === module) {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    },
  );
}
