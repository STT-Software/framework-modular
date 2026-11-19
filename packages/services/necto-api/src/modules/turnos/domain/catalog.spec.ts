import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { suggestedProfileFor, TURNOS_PROFILES } from './catalog';

describe('profile catalog', () => {
  it('gives every profile at least one default queue', () => {
    for (const profile of TURNOS_PROFILES) assert.ok(profile.queues.length > 0, profile.id);
  });
  it('suggests a profile for every business category', () => {
    assert.deepEqual(
      ['gastronomy', 'health-wellness', 'retail', 'professional-services', 'other', 'unknown'].map(suggestedProfileFor),
      ['restaurant', 'clinic', 'bank', 'bank', 'custom', 'custom'],
    );
  });
});
