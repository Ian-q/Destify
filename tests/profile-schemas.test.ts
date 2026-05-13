import { describe, it, expect } from 'vitest';

import { Tier1ProfileInput, TripContextInput } from '@/lib/profile-schemas';

describe('Tier1ProfileInput', () => {
  const valid = {
    citizenships: [{ country: 'US', passportExpiry: '2029-08-15' }],
    residence: { country: 'US', visaStatus: null },
    idpConvention: null,
    idpExpiry: null,
    controlledMeds: [],
    hasMinors: false,
  };

  it('accepts a valid Tier-1 input with new citizenship + residence shapes', () => {
    expect(Tier1ProfileInput.safeParse(valid).success).toBe(true);
  });

  it('accepts a citizenship with null passportExpiry', () => {
    const r = Tier1ProfileInput.safeParse({
      ...valid,
      citizenships: [{ country: 'US', passportExpiry: null }],
    });
    expect(r.success).toBe(true);
  });

  it('accepts a null residence (no residence on file)', () => {
    expect(Tier1ProfileInput.safeParse({ ...valid, residence: null }).success).toBe(true);
  });

  it('rejects non-alpha-2 country in citizenship', () => {
    expect(Tier1ProfileInput.safeParse({
      ...valid,
      citizenships: [{ country: 'USA', passportExpiry: null }],
    }).success).toBe(false);
  });

  it('rejects malformed passportExpiry', () => {
    expect(Tier1ProfileInput.safeParse({
      ...valid,
      citizenships: [{ country: 'US', passportExpiry: '08/15/2029' }],
    }).success).toBe(false);
  });

  it('rejects residence with bad country', () => {
    expect(Tier1ProfileInput.safeParse({
      ...valid,
      residence: { country: 'USA', visaStatus: null },
    }).success).toBe(false);
  });

  it('accepts known visaStatus values', () => {
    for (const v of ['tourist', 'permanent', 'digital-nomad', 'work', 'other']) {
      const r = Tier1ProfileInput.safeParse({
        ...valid,
        residence: { country: 'US', visaStatus: v },
      });
      expect(r.success).toBe(true);
    }
  });

  it('rejects unknown visaStatus values', () => {
    expect(Tier1ProfileInput.safeParse({
      ...valid,
      residence: { country: 'US', visaStatus: 'student-loophole' },
    }).success).toBe(false);
  });

  it('rejects unknown top-level fields (strict)', () => {
    expect(Tier1ProfileInput.safeParse({ ...valid, hackField: true }).success).toBe(false);
  });

  it('rejects the old string[] citizenships shape', () => {
    expect(Tier1ProfileInput.safeParse({
      ...valid,
      citizenships: ['US'],
    }).success).toBe(false);
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

  it('rejects an unknown purpose', () => {
    expect(TripContextInput.safeParse({ ...valid, purpose: 'pilgrimage' }).success).toBe(false);
  });
});
