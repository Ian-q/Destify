import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYAML } from 'yaml';
import { sql } from 'drizzle-orm';
import { conditionRow } from '@/lib/db/schema';
import { ROW_TYPES, type RowType } from './registry';

// Intentionally loose — must work with both drizzle-orm/neon-http and drizzle-orm/pglite.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { insert: (table: any) => any };

const SEED_DIR = join(process.cwd(), 'src/data/conditions');

export async function loadSeedRows(db: AnyDb): Promise<{ count: number }> {
  let count = 0;
  for (const type of Object.keys(ROW_TYPES) as RowType[]) {
    const typeDir = join(SEED_DIR, type);
    const files = await readdir(typeDir).catch(() => [] as string[]);
    for (const file of files) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
      const key = file.replace(/\.ya?ml$/, '');
      const raw = await readFile(join(typeDir, file), 'utf-8');
      const parsed = parseYAML(raw);
      const validated = ROW_TYPES[type].schema.parse(parsed);
      await db.insert(conditionRow).values({
        rowType: type, rowKey: key, data: validated,
        source: 'seed', confidence: null, citations: null,
        expiresAt: null,
      }).onConflictDoUpdate({
        target: [conditionRow.rowType, conditionRow.rowKey],
        set: { data: validated, source: 'seed', expiresAt: null, fetchedAt: sql`now()` },
      });
      count++;
    }
  }
  return { count };
}
