import { describe, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { loadSeedRows } from '@/lib/conditions/seed';

vi.mock('@/lib/conditions/ai', () => ({ fetchRowViaAI: vi.fn().mockResolvedValue(null) }));

import { hydrateLeg } from '@/lib/conditions/readiness';
import { resolveFlow } from '@/lib/rules/index';
import type { PermanentProfile, TripContext } from '@/lib/user-profile';
import type { Leg } from '@/lib/rules/types';

describe('US→JP 9-night leg, full resolution', () => {
  it('auto-resolves n-visa=no via seeded visa_exemption row', async () => {
    const pg = new PGlite();
    const db = drizzle(pg);
    await migrate(db, { migrationsFolder: './drizzle' });
    await loadSeedRows(db);

    const profile: PermanentProfile = {
      userId: 'u1',
      citizenships: [{ country: 'US', passportExpiry: '2029-08-15' }],
      residence: { country: 'US', visaStatus: null },
      idpConvention: null, idpExpiry: null,
      controlledMeds: [], hasMinors: false, extras: {},
    };
    const context: TripContext = {
      tripId: 't1', travelingWithMinors: false, drivingAtDestination: false,
      carryingControlledMeds: false, purpose: 'tourism', extras: {},
    };
    const leg: Leg = { from: 'US', to: 'JP', startDate: '2026-06-01', endDate: '2026-06-10' };

    const { facts } = await hydrateLeg(profile, context, leg, { flowId: 'preflight-jp', db });
    const out = resolveFlow('preflight-jp', profile, context, leg, { tables: facts.tables });

    expect(out['n-visa'].choiceId).toBe('no');
    expect(out['n-visa'].ruleId).toBe('jp.preflight.visa.us-exempt');
    expect(out['n-meds'].choiceId).toBe('no');
    expect(out['n-kids'].choiceId).toBe('no');
    expect(out['n-drive'].choiceId).toBe('no');
  });
});
