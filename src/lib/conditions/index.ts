import { sql, and, eq } from 'drizzle-orm';
import { conditionRow } from '@/lib/db/schema';
import { ROW_TYPES, type RowType, type RowOf } from './registry';
import { fetchRowViaAI } from './ai';

export { ROW_TYPES };
export type { RowType, RowOf };

// Intentionally loose — must work with both drizzle-orm/neon-http and drizzle-orm/pglite.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

export async function getRow<T extends RowType>(
  type: T, key: string, opts: { db?: AnyDb } = {},
): Promise<RowOf<T> | null> {
  // Lazy-import default db only when needed (avoids DATABASE_URL crash in tests)
  const db: AnyDb = opts.db ?? (await import('@/lib/db/client')).db;

  const existing = await db
    .select().from(conditionRow)
    .where(and(eq(conditionRow.rowType, type), eq(conditionRow.rowKey, key)))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    const fresh = row.expiresAt === null || row.expiresAt > new Date();
    if (fresh) return row.data as RowOf<T>;
    // Expired — fall through to AI, but remember as stale fallback
    const stale = row.data as RowOf<T>;
    const fetched = await fetchRowViaAI(type, key);
    if (!fetched) return stale;
    await upsertAIRow(db, type, key, fetched);
    return fetched.data as RowOf<T>;
  }

  const fetched = await fetchRowViaAI(type, key);
  if (!fetched) return null;
  await upsertAIRow(db, type, key, fetched);
  return fetched.data as RowOf<T>;
}

async function upsertAIRow<T extends RowType>(
  db: AnyDb,
  type: T,
  key: string,
  fetched: { data: RowOf<T>; confidence: 'high' | 'medium' | 'low'; citations: unknown[] },
) {
  const ttl = ROW_TYPES[type].ttlDays;
  const expiresAt = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000);
  await db.insert(conditionRow).values({
    rowType: type,
    rowKey: key,
    data: fetched.data,
    source: 'ai',
    confidence: fetched.confidence,
    citations: fetched.citations,
    expiresAt,
  }).onConflictDoUpdate({
    target: [conditionRow.rowType, conditionRow.rowKey],
    set: {
      data: fetched.data,
      source: 'ai',
      confidence: fetched.confidence,
      citations: fetched.citations,
      expiresAt,
      fetchedAt: sql`now()`,
    },
    where: eq(conditionRow.source, 'ai'),
  });
}
