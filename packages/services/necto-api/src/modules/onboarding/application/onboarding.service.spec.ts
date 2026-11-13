import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PhoneAlreadyInUseError, PhoneRequiredError } from '../domain/errors';
import type { OnboardingProfile } from '../domain/onboarding-profile';
import { OnboardingProfileRepository } from '../domain/onboarding-profile.repository';
import type { ProfileSource } from '../domain/profile-sources';
import { OnboardingService } from './onboarding.service';

/** In-memory repository with the same rules as the MongoDB one: one profile per user, phone unique across users. */
class InMemoryOnboardingProfileRepository extends OnboardingProfileRepository {
  readonly profiles = new Map<string, OnboardingProfile>();

  async findByUserId(userId: string) {
    return this.profiles.get(userId) ?? null;
  }

  async savePhone(userId: string, phone: string) {
    const owner = [...this.profiles.values()].find((p) => p.phone === phone);
    if (owner && owner.userId !== userId) throw new PhoneAlreadyInUseError();
    const profile = this.profiles.get(userId) ?? { userId, phone, sources: [], completedAt: null };
    const saved = { ...profile, phone };
    this.profiles.set(userId, saved);
    return saved;
  }

  async saveSources(userId: string, sources: ProfileSource[], completedAt: Date) {
    const profile = this.profiles.get(userId);
    if (!profile) return null;
    const saved = { ...profile, sources, completedAt };
    this.profiles.set(userId, saved);
    return saved;
  }
}

function setup() {
  const repository = new InMemoryOnboardingProfileRepository();
  return { repository, service: new OnboardingService(repository) };
}

describe('OnboardingService', () => {
  it('returns an empty, incomplete profile for a user with none', async () => {
    const { service } = setup();
    assert.deepEqual(await service.get('user-1'), { phone: null, sources: [], completed: false });
  });

  it('saves the phone as step 1 without completing the profile', async () => {
    const { service } = setup();
    assert.deepEqual(await service.savePhone('user-1', '+573001234567'), {
      phone: '+573001234567',
      sources: [],
      completed: false,
    });
  });

  it('does not let two users share a phone, but lets a user save their own again', async () => {
    const { service } = setup();
    await service.savePhone('user-1', '+573001234567');

    await assert.rejects(service.savePhone('user-2', '+573001234567'), PhoneAlreadyInUseError);
    assert.equal((await service.savePhone('user-1', '+573001234567')).phone, '+573001234567');
    assert.equal((await service.savePhone('user-2', '+573009998877')).phone, '+573009998877');
  });

  it('requires the phone before the sources', async () => {
    const { service } = setup();
    await assert.rejects(service.saveSources('user-1', ['instagram']), PhoneRequiredError);
  });

  it('completes the profile with the sources and keeps the first completion date when saved again', async () => {
    const { service, repository } = setup();
    await service.savePhone('user-1', '+573001234567');

    const first = await service.saveSources('user-1', ['instagram', 'family']);
    assert.deepEqual(first, { phone: '+573001234567', sources: ['instagram', 'family'], completed: true });
    const completedAt = repository.profiles.get('user-1')!.completedAt;

    const second = await service.saveSources('user-1', ['other']);
    assert.deepEqual(second.sources, ['other']);
    assert.deepEqual(repository.profiles.get('user-1')!.completedAt, completedAt);
  });

  it('keeps each profile separate by user id', async () => {
    const { service } = setup();
    await service.savePhone('user-1', '+573001234567');
    await service.saveSources('user-1', ['tiktok']);

    assert.deepEqual(await service.get('user-2'), { phone: null, sources: [], completed: false });
  });
});
