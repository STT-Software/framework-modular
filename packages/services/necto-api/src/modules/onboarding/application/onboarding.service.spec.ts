import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FixedClock } from '../../../platform/time/fixed-clock.spec';
import { PhoneAlreadyInUseError, PhoneRequiredError } from '../domain/errors';
import type { OnboardingProfile } from '../domain/onboarding-profile';
import { OnboardingProfileRepository } from '../domain/onboarding-profile.repository';
import type { ProfileSource } from '../domain/profile-sources';
import { OnboardingService } from './onboarding.service';

/** In-memory repository with the same rules as the MongoDB one: one profile per user, phone unique across users. */
class InMemoryOnboardingProfileRepository extends OnboardingProfileRepository {
  readonly profiles = new Map<string, OnboardingProfile>();
  readonly introViews = new Map<string, Date>();

  async findIntroSeenAt(userId: string) {
    return this.introViews.get(userId) ?? null;
  }

  async markIntroSeen(userId: string, seenAt: Date) {
    if (!this.introViews.has(userId)) this.introViews.set(userId, seenAt);
  }

  async findByUserId(userId: string) {
    return this.profiles.get(userId) ?? null;
  }

  async savePhone(userId: string, phone: string) {
    const owner = [...this.profiles.values()].find((p) => p.phone === phone);
    if (owner && owner.userId !== userId) throw new PhoneAlreadyInUseError();
    const profile = this.profiles.get(userId) ?? { userId, phone, sources: [], sourceOther: null, completedAt: null };
    const saved = { ...profile, phone };
    this.profiles.set(userId, saved);
    return saved;
  }

  async saveSources(userId: string, sources: ProfileSource[], sourceOther: string | null, completedAt: Date) {
    const profile = this.profiles.get(userId);
    if (!profile) return null;
    const saved = { ...profile, sources, sourceOther, completedAt };
    this.profiles.set(userId, saved);
    return saved;
  }
}

function setup() {
  const repository = new InMemoryOnboardingProfileRepository();
  const clock = new FixedClock();
  return { repository, clock, service: new OnboardingService(repository, clock) };
}

const EMPTY = { phone: null, sources: [], sourceOther: null, completed: false, introSeen: false };

describe('OnboardingService', () => {
  it('returns an empty, incomplete profile for a user with none', async () => {
    const { service } = setup();
    assert.deepEqual(await service.get('user-1'), EMPTY);
  });

  it('saves the phone as step 1 without completing the profile, and counts it as past the intro', async () => {
    const { service } = setup();
    assert.deepEqual(await service.savePhone('user-1', '+573001234567'), {
      phone: '+573001234567',
      sources: [],
      sourceOther: null,
      completed: false,
      introSeen: true,
    });
  });

  it('stores the phone in its canonical E.164 form, whatever separators it came with', async () => {
    const { service, repository } = setup();
    assert.equal((await service.savePhone('user-1', ' +57 300 123-4567 ')).phone, '+573001234567');
    assert.equal(repository.profiles.get('user-1')!.phone, '+573001234567');
  });

  it('rejects a phone that is not a valid mobile number (callers that skip the DTO)', async () => {
    const { service, repository } = setup();
    await assert.rejects(service.savePhone('user-1', '3001234567'), TypeError);
    await assert.rejects(service.savePhone('user-1', '+5716012345'), TypeError, 'a Colombian landline is not a mobile');
    assert.equal(repository.profiles.size, 0);
  });

  it('does not let two users share a phone, even written differently, but lets a user save their own again', async () => {
    const { service } = setup();
    await service.savePhone('user-1', '+573001234567');

    await assert.rejects(service.savePhone('user-2', '+57 300 123 4567'), (error: unknown) => {
      assert.ok(error instanceof PhoneAlreadyInUseError);
      assert.equal(error.code, 'phone-in-use');
      assert.equal(error.kind, 'conflict');
      return true;
    });
    assert.equal((await service.savePhone('user-1', '+573001234567')).phone, '+573001234567');
    assert.equal((await service.savePhone('user-2', '+573009998877')).phone, '+573009998877');
  });

  it('requires the phone before the sources, with the phone-required code', async () => {
    const { service } = setup();
    await assert.rejects(service.saveSources('user-1', ['instagram']), (error: unknown) => {
      assert.ok(error instanceof PhoneRequiredError);
      assert.equal(error.code, 'phone-required');
      return true;
    });
    await assert.rejects(service.saveSources('user-1', []), PhoneRequiredError, 'skipping also needs the phone');
  });

  it('completes the profile with the sources at the clock time and keeps that date when saved again', async () => {
    const { service, repository, clock } = setup();
    await service.savePhone('user-1', '+573001234567');

    const first = await service.saveSources('user-1', ['instagram']);
    assert.deepEqual(first, {
      phone: '+573001234567',
      sources: ['instagram'],
      sourceOther: null,
      completed: true,
      introSeen: true,
    });
    assert.deepEqual(repository.profiles.get('user-1')!.completedAt, clock.now());
    const completedAt = repository.profiles.get('user-1')!.completedAt;

    clock.advance(60_000);
    const second = await service.saveSources('user-1', ['tiktok']);
    assert.deepEqual(second.sources, ['tiktok']);
    assert.deepEqual(repository.profiles.get('user-1')!.completedAt, completedAt);
  });

  it('lets the person skip step 2: an empty list completes the profile too', async () => {
    const { service, repository, clock } = setup();
    await service.savePhone('user-1', '+573001234567');

    const skipped = await service.saveSources('user-1', []);
    assert.deepEqual(skipped, { phone: '+573001234567', sources: [], sourceOther: null, completed: true, introSeen: true });
    assert.deepEqual(repository.profiles.get('user-1')!.completedAt, clock.now());
  });

  it('keeps the free text only with "other", trimmed, and drops it with any other choice', async () => {
    const { service } = setup();
    await service.savePhone('user-1', '+573001234567');

    assert.equal((await service.saveSources('user-1', ['other'], '  Un amigo del gimnasio  ')).sourceOther, 'Un amigo del gimnasio');
    assert.equal((await service.saveSources('user-1', ['other'], '   ')).sourceOther, null, 'blank means none');
    assert.equal((await service.saveSources('user-1', ['instagram'], 'Un amigo')).sourceOther, null);
    assert.equal((await service.saveSources('user-1', [], 'Un amigo')).sourceOther, null);

    await service.saveSources('user-1', ['other'], 'Un amigo');
    assert.equal((await service.saveSources('user-1', ['family'])).sourceOther, null, 'a change of mind drops the old text');
    assert.equal((await service.get('user-1')).sourceOther, null);
  });

  it('keeps each profile separate by user id', async () => {
    const { service } = setup();
    await service.savePhone('user-1', '+573001234567');
    await service.saveSources('user-1', ['tiktok']);

    assert.deepEqual(await service.get('user-2'), EMPTY);
  });

  it('shows the intro only until it is marked as seen, and keeps the first date from the clock', async () => {
    const { service, repository, clock } = setup();
    assert.equal((await service.get('user-1')).introSeen, false);

    assert.equal((await service.markIntroSeen('user-1')).introSeen, true);
    const firstSeen = repository.introViews.get('user-1');
    assert.deepEqual(firstSeen, clock.now());
    clock.advance(60_000);
    await service.markIntroSeen('user-1');

    assert.equal((await service.get('user-1')).introSeen, true);
    assert.equal(repository.introViews.get('user-1'), firstSeen);
    assert.equal((await service.get('user-2')).introSeen, false);
  });

  it('counts a saved phone or a completed profile as having seen the intro, without an intro view', async () => {
    const { service, repository } = setup();
    await service.savePhone('user-1', '+573001234567');
    assert.equal((await service.get('user-1')).introSeen, true);

    await service.saveSources('user-1', ['whatsapp']);
    assert.equal((await service.get('user-1')).introSeen, true);
    assert.equal(repository.introViews.has('user-1'), false);
  });
});
