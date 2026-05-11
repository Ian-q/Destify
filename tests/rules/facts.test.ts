import { describe, it, expect } from 'vitest';
import { buildFacts } from '@/lib/rules/facts';
import type { PermanentProfile, TripContext } from '@/lib/user-profile';
import type { Leg } from '@/lib/rules/types';

const profile: PermanentProfile = {
  userId: 'u1', citizenships: ['US'], homeCountry: 'US',
  idpConvention: '1949', idpExpiry: '2030-01-01',
  controlledMeds: [], hasMinors: false, extras: {},
};
const context: TripContext = {
  tripId: 't1', travelingWithMinors: false, drivingAtDestination: false,
  carryingControlledMeds: false, purpose: 'tourism', extras: {},
};
const leg: Leg = { from: 'US', to: 'JP', startDate: '2026-06-01', endDate: '2026-06-10' };

describe('buildFacts', () => {
  it('computes stayDays inclusive of both dates', () => {
    const f = buildFacts(profile, context, leg);
    expect(f.stayDays).toBe(9);
  });

  it('marks idp1949Valid true when expiry is past leg end', () => {
    const f = buildFacts(profile, context, leg);
    expect(f.idp1949Valid).toBe(true);
    expect(f.idp1968Valid).toBe(false);
  });

  it('marks idp1949Valid false when expiry is before leg end', () => {
    const f = buildFacts({ ...profile, idpExpiry: '2025-01-01' }, context, leg);
    expect(f.idp1949Valid).toBe(false);
  });

  it('initializes empty tables when none provided', () => {
    const f = buildFacts(profile, context, leg);
    expect(f.tables).toEqual({});
  });

  it('passes through provided tables', () => {
    const tables = { visa_exemption: { 'US:JP': { exemptDays: 90 } } } as any;
    const f = buildFacts(profile, context, leg, { tables });
    expect(f.tables.visa_exemption?.['US:JP'].exemptDays).toBe(90);
  });
});
