import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { conditionRow } from '@/lib/db/schema';
import { loadSeedRows } from '@/lib/conditions/seed';
import { eq } from 'drizzle-orm';

describe('loadSeedRows', () => {
  let pg: PGlite;
  let testDb: ReturnType<typeof drizzle>;

  beforeEach(async () => {
    pg = new PGlite();
    testDb = drizzle(pg);
    await migrate(testDb, { migrationsFolder: './drizzle' });
  });

  it('upserts visa_exemption US:JP from src/data/conditions/', async () => {
    await loadSeedRows(testDb);
    const rows = await testDb.select().from(conditionRow).where(eq(conditionRow.rowKey, 'US:JP'));
    expect(rows.length).toBe(1);
    expect(rows[0].rowType).toBe('visa_exemption');
    expect((rows[0].data as any).exemptDays).toBe(90);
    expect(rows[0].source).toBe('seed');
    expect(rows[0].expiresAt).toBeNull();
  });

  it('is idempotent (running twice yields same row count)', async () => {
    await loadSeedRows(testDb);
    const before = await testDb.select().from(conditionRow);
    await loadSeedRows(testDb);
    const after = await testDb.select().from(conditionRow);
    expect(after.length).toBe(before.length);
  });
});
