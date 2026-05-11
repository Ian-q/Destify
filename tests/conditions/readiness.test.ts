import { describe, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { loadSeedRows } from '@/lib/conditions/seed';

vi.mock('@/lib/conditions/ai', () => ({ fetchRowViaAI: vi.fn().mockResolvedValue(null) }));

import { hydrateLeg } from '@/lib/conditions/readiness';
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

describe('hydrateLeg', () => {
  it('hydrates visa_exemption, med_import, and driving for a JP leg from seed', async () => {
    const pg = new PGlite();
    const db = drizzle(pg);
    await migrate(db, { migrationsFolder: './drizzle' });
    await loadSeedRows(db);

    const result = await hydrateLeg(profile, context, leg, { flowId: 'preflight-jp', db });

    expect(result.facts.tables.visa_exemption?.['US:JP'].exemptDays).toBe(90);
    expect(result.facts.tables.med_import?.['JP']).toBeDefined();
    expect(result.facts.tables.driving?.['JP'].idpConvention).toBe('1949');
    expect(result.missing).toEqual([]);
  });

  it('reports missing rows when seed and AI both fail', async () => {
    const pg = new PGlite();
    const db = drizzle(pg);
    await migrate(db, { migrationsFolder: './drizzle' });

    const result = await hydrateLeg(profile, context, leg, { flowId: 'preflight-jp', db });

    expect(result.facts.tables.visa_exemption).toBeUndefined();
    expect(result.missing.length).toBeGreaterThan(0);
  });
});
