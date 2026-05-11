import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { loadSeedRows } from '@/lib/conditions/seed';

vi.mock('@/lib/conditions/ai', () => ({ fetchRowViaAI: vi.fn() }));
import { fetchRowViaAI } from '@/lib/conditions/ai';
import { getRow } from '@/lib/conditions';

const mockAI = fetchRowViaAI as unknown as ReturnType<typeof vi.fn>;

async function freshDb() {
  const pg = new PGlite();
  const db = drizzle(pg);
  await migrate(db, { migrationsFolder: './drizzle' });
  return db;
}

describe('getRow', () => {
  beforeEach(() => { mockAI.mockReset(); });

  it('returns a seed row without calling AI', async () => {
    const db = await freshDb();
    await loadSeedRows(db);
    const row = await getRow('visa_exemption', 'US:JP', { db });
    expect(row).not.toBeNull();
    expect(row!.exemptDays).toBe(90);
    expect(mockAI).not.toHaveBeenCalled();
  });

  it('calls AI on cache miss, persists result, and caches subsequent calls', async () => {
    const db = await freshDb();
    mockAI.mockResolvedValueOnce({
      data: { exemptDays: 30 },
      confidence: 'high',
      citations: [],
    });
    const first = await getRow('visa_exemption', 'XX:YY', { db });
    expect(first!.exemptDays).toBe(30);
    expect(mockAI).toHaveBeenCalledTimes(1);

    const second = await getRow('visa_exemption', 'XX:YY', { db });
    expect(second!.exemptDays).toBe(30);
    expect(mockAI).toHaveBeenCalledTimes(1); // still 1: cache hit
  });

  it('returns null when AI also fails and there is no stale row', async () => {
    const db = await freshDb();
    mockAI.mockResolvedValueOnce(null);
    const row = await getRow('visa_exemption', 'AA:BB', { db });
    expect(row).toBeNull();
  });
});
