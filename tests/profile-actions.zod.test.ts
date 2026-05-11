import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { Tier1ProfileInput, TripContextInput } from '@/lib/profile-actions';

describe('Tier1ProfileInput', () => {
  const valid = {
    citizenships: ['US'],
    homeCountry: 'US',
    idpConvention: null,
    idpExpiry: null,
    controlledMeds: [],
    hasMinors: false,
  };

  it('accepts a valid Tier-1 input', () => {
    expect(Tier1ProfileInput.safeParse(valid).success).toBe(true);
  });

  it('rejects non-alpha-2 country codes', () => {
    expect(Tier1ProfileInput.safeParse({ ...valid, citizenships: ['USA'] }).success).toBe(false);
  });

  it('rejects malformed idpExpiry dates', () => {
    expect(Tier1ProfileInput.safeParse({ ...valid, idpExpiry: '06/01/2026' }).success).toBe(false);
  });

  it('rejects unknown top-level fields (strict)', () => {
    expect(Tier1ProfileInput.safeParse({ ...valid, hackField: true }).success).toBe(false);
  });
});

describe('TripContextInput', () => {
  const valid = {
    travelingWithMinors: false,
    drivingAtDestination: false,
    carryingControlledMeds: false,
    purpose: 'tourism' as const,
  };

  it('accepts a valid trip context', () => {
    expect(TripContextInput.safeParse(valid).success).toBe(true);
  });

  it('rejects unknown purpose values', () => {
    expect(TripContextInput.safeParse({ ...valid, purpose: 'leisure' }).success).toBe(false);
  });

  it('rejects unknown fields (strict)', () => {
    expect(TripContextInput.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });
});
