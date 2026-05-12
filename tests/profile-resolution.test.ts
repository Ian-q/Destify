import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/conditions/ai', () => ({ fetchRowViaAI: vi.fn().mockResolvedValue(null) }));
// Avoid initializing the prod neon client at module load (no DATABASE_URL in tests).
// The test passes its own pglite handle to resolveFlow(db, flowId).
vi.mock('@/lib/db/client', () => ({ db: null }));

const cookieStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (n: string) => cookieStore.has(n) ? { name: n, value: cookieStore.get(n)! } : undefined,
    set: (n: string, v: string) => { cookieStore.set(n, v); },
    delete: (n: string) => { cookieStore.delete(n); },
  }),
}));

import { signInDemo } from '@/lib/auth-actions';
import { saveProfile } from '@/lib/profile-db';
import { resolveFlow } from '@/lib/conditions/actions';
import { loadSeedRows } from '@/lib/conditions/seed';

async function makeDb() {
  const pg = new PGlite();
  const db = drizzle(pg);
  await migrate(db, { migrationsFolder: './drizzle' });
  await loadSeedRows(db);
  return db;
}

describe('profile-driven resolution', () => {
  beforeEach(() => cookieStore.clear());

  it('US citizenship auto-resolves n-visa via seeded US:JP row', async () => {
    const db = await makeDb();
    const { userId } = await signInDemo(db);
    await saveProfile(db, userId, {
      citizenships: ['US'], homeCountry: 'US',
      idpConvention: null, idpExpiry: null,
      controlledMeds: [], hasMinors: false,
    });

    const { output } = await resolveFlow(db, 'preflight-jp');
    expect(output['n-visa']?.choiceId).toBe('no');
  });

  it('KE citizenship does not auto-resolve n-visa (no seed row, AI mock returns null)', async () => {
    const db = await makeDb();
    const { userId } = await signInDemo(db);
    await saveProfile(db, userId, {
      citizenships: ['KE'], homeCountry: 'KE',
      idpConvention: null, idpExpiry: null,
      controlledMeds: [], hasMinors: false,
    });

    const { output } = await resolveFlow(db, 'preflight-jp');
    expect(output['n-visa']).toBeUndefined();
  });

  it('flipping citizenship from US to KE removes auto-resolution', async () => {
    const db = await makeDb();
    const { userId } = await signInDemo(db);

    await saveProfile(db, userId, {
      citizenships: ['US'], homeCountry: 'US',
      idpConvention: null, idpExpiry: null,
      controlledMeds: [], hasMinors: false,
    });
    expect((await resolveFlow(db, 'preflight-jp')).output['n-visa']?.choiceId).toBe('no');

    await saveProfile(db, userId, {
      citizenships: ['KE'], homeCountry: 'KE',
      idpConvention: null, idpExpiry: null,
      controlledMeds: [], hasMinors: false,
    });
    expect((await resolveFlow(db, 'preflight-jp')).output['n-visa']).toBeUndefined();
  });
});
