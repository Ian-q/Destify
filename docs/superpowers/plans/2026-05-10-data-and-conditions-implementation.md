# Data Model & Conditions Sourcing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the data model, conditions sourcing layer, and rule-layer integration described in [2026-05-10-data-and-conditions-design.md](../specs/2026-05-10-data-and-conditions-design.md) so that opening the JP preflight flow auto-resolves `n-visa` from a hydrated `visa_exemption` row pulled from Postgres (seed → AI fallback).

**Architecture:** Three phases. **A — Foundations:** install deps, Vercel/Neon setup, Drizzle schemas, vitest, migration. **B — Conditions sourcing:** registry + Zod + seed loader + AI fallback + `getRow`. **C — Rule-layer integration:** `requiredRows` declaration, `hydrateLeg`, widened `Facts`, table-driven JP visa rule, `FlowGraphView` async wiring.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, Neon Postgres (Vercel Marketplace), `@neondatabase/serverless`, Vercel AI Gateway via `ai` SDK, Zod, `yaml`, vitest, `@electric-sql/pglite` (embedded Postgres for tests).

---

## Pre-flight (user-driven, one-time)

These steps require a logged-in human; agents cannot run them. The plan assumes they have been completed before Phase A.

- [ ] **U1.** Install Vercel CLI globally: `npm i -g vercel`. Verify: `vercel --version` prints a version.
- [ ] **U2.** Link this repo to the Vercel project: `vercel link`. Pick the existing Destify project.
- [ ] **U3.** Add a Neon Postgres integration via Vercel Dashboard → Storage → Add → Neon. Accept defaults; the free tier is sufficient.
- [ ] **U4.** Enable Vercel AI Gateway in Project Settings → AI. No extra config; the project's OIDC token is used in deployed envs and an `AI_GATEWAY_API_KEY` is generated for local dev.
- [ ] **U5.** Pull env vars locally: `vercel env pull .env.local`. Verify `.env.local` contains `DATABASE_URL` (from Neon) and `AI_GATEWAY_API_KEY`. Add `.env.local` to `.gitignore` if not already present (`git check-ignore .env.local`).

---

## Phase A — Foundations

### Task 1: Install runtime + dev dependencies

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install runtime deps**

```bash
npm i drizzle-orm @neondatabase/serverless zod yaml ai
```

- [ ] **Step 2: Install dev deps**

```bash
npm i -D drizzle-kit vitest @vitest/coverage-v8 @electric-sql/pglite tsx
```

- [ ] **Step 3: Verify package.json picked up both groups**

Run: `node -e "const p=require('./package.json'); for (const k of ['drizzle-orm','@neondatabase/serverless','zod','yaml','ai']) if (!p.dependencies[k]) throw new Error('missing dep: '+k); for (const k of ['drizzle-kit','vitest','@electric-sql/pglite','tsx']) if (!p.devDependencies[k]) throw new Error('missing dev dep: '+k); console.log('ok');"`

Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Install drizzle, zod, ai, yaml, vitest, pglite"
```

### Task 2: Configure vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `test` script)

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: [],
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

- [ ] **Step 2: Add `test` and `test:watch` scripts to package.json**

Edit `package.json` → `scripts`:

```json
{
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create a smoke test**

Create `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run it**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json tests/smoke.test.ts
git commit -m "Add vitest config and smoke test"
```

### Task 3: Configure Drizzle

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/lib/db/client.ts`
- Create: `src/lib/db/schema.ts` (empty stub)

- [ ] **Step 1: Read the Next.js env-vars guide once before touching env-loading code.**

```bash
ls node_modules/next/dist/docs/ 2>/dev/null | head -20
```

If a relevant guide exists (`environment-variables.md`, `configuring/environment-variables.md`, etc.), `cat` it. Otherwise rely on the canonical Next.js docs page: `https://nextjs.org/docs/app/api-reference/file-conventions/.env`.

- [ ] **Step 2: Create `drizzle.config.ts`**

```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL not set — run `vercel env pull .env.local` first.');
}

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL },
  strict: true,
  verbose: true,
});
```

- [ ] **Step 3: Install `dotenv` (used by drizzle.config.ts)**

```bash
npm i -D dotenv
```

- [ ] **Step 4: Create `src/lib/db/client.ts`**

```ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL not set');
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });
```

- [ ] **Step 5: Create empty `src/lib/db/schema.ts`**

```ts
// Drizzle table definitions. Populated in Tasks 4–8.
export {};
```

- [ ] **Step 6: Verify drizzle-kit can read the config**

Run: `npx drizzle-kit generate --name init 2>&1 | head -5`
Expected: no error about config; says "No schema changes" or generates an empty migration. If empty migration created, delete the file from `drizzle/`.

- [ ] **Step 7: Commit**

```bash
git add drizzle.config.ts src/lib/db/client.ts src/lib/db/schema.ts package.json package-lock.json
git commit -m "Configure Drizzle with Neon HTTP driver"
```

### Task 4: Define `users` and `permanent_profile` schemas

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Write the table definitions**

Replace the contents of `src/lib/db/schema.ts` with:

```ts
import { pgTable, uuid, text, boolean, date, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const idpConvention = pgEnum('idp_convention', ['1949', '1968']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const permanentProfile = pgTable('permanent_profile', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  citizenships: text('citizenships').array().notNull().default([]),
  homeCountry: text('home_country'),
  idpConvention: idpConvention('idp_convention'),
  idpExpiry: date('idp_expiry'),
  controlledMeds: text('controlled_meds').array().notNull().default([]),
  hasMinors: boolean('has_minors').notNull().default(false),
  extras: jsonb('extras').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "Add users and permanent_profile schemas"
```

### Task 5: Define `trip`, `leg`, `trip_context` schemas

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Append to `src/lib/db/schema.ts`**

```ts
import { integer, uniqueIndex } from 'drizzle-orm/pg-core';

export const tripStatus = pgEnum('trip_status', ['planning', 'booked', 'active', 'past']);
export const tripPurpose = pgEnum('trip_purpose', ['tourism', 'business', 'family', 'study']);

export const trip = pgTable('trip', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: tripStatus('status').notNull().default('planning'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const leg = pgTable('leg', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trip.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),
  fromCountry: text('from_country').notNull(),
  toCountry: text('to_country').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
}, (t) => ({
  tripSeqUnique: uniqueIndex('leg_trip_seq_unique').on(t.tripId, t.seq),
}));

export const tripContext = pgTable('trip_context', {
  tripId: uuid('trip_id').primaryKey().references(() => trip.id, { onDelete: 'cascade' }),
  travelingWithMinors: boolean('traveling_with_minors').notNull().default(false),
  drivingAtDestination: boolean('driving_at_destination').notNull().default(false),
  carryingControlledMeds: boolean('carrying_controlled_meds').notNull().default(false),
  purpose: tripPurpose('purpose'),
  extras: jsonb('extras').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "Add trip, leg, and trip_context schemas"
```

### Task 6: Define `condition_row` schema

**Files:**
- Modify: `src/lib/db/schema.ts`

- [ ] **Step 1: Append to `src/lib/db/schema.ts`**

```ts
import { primaryKey } from 'drizzle-orm/pg-core';

export const conditionSource = pgEnum('condition_source', ['seed', 'ai']);
export const conditionConfidence = pgEnum('condition_confidence', ['high', 'medium', 'low']);

export const conditionRow = pgTable('condition_row', {
  rowType: text('row_type').notNull(),
  rowKey: text('row_key').notNull(),
  data: jsonb('data').notNull(),
  source: conditionSource('source').notNull(),
  confidence: conditionConfidence('confidence'),
  citations: jsonb('citations'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
}, (t) => ({
  pk: primaryKey({ columns: [t.rowType, t.rowKey] }),
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "Add condition_row schema"
```

### Task 7: Generate and apply the initial migration

**Files:**
- Generated: `drizzle/0000_*.sql`, `drizzle/meta/`

- [ ] **Step 1: Generate the migration**

Run: `npx drizzle-kit generate --name init`
Expected: creates `drizzle/0000_<random>.sql` with `CREATE TYPE` and `CREATE TABLE` statements for all 6 tables.

- [ ] **Step 2: Push the migration to Neon**

Run: `npx drizzle-kit push`
Expected: prompts to confirm; pick "Yes". Reports tables created.

- [ ] **Step 3: Verify via a quick query**

Create `scripts/db-smoke.ts`:

```ts
import 'dotenv/config';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';

async function main() {
  const rows = await db.select().from(users).limit(1);
  console.log('users table reachable, rows:', rows.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run: `npx tsx scripts/db-smoke.ts`
Expected: `users table reachable, rows: 0`.

- [ ] **Step 4: Commit**

```bash
git add drizzle/ scripts/db-smoke.ts
git commit -m "Initial migration: create all 6 tables"
```

---

## Phase B — Conditions sourcing

### Task 8: ProfileExtras and TripContextExtras Zod schemas

**Files:**
- Create: `src/lib/profile-extras.ts`
- Test: `tests/profile-extras.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/profile-extras.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ProfileExtras, TripContextExtras } from '@/lib/profile-extras';

describe('ProfileExtras', () => {
  it('accepts an empty object', () => {
    expect(ProfileExtras.safeParse({}).success).toBe(true);
  });

  it('accepts cards and pointsProgs', () => {
    const r = ProfileExtras.safeParse({
      cards: [{ network: 'amex', tier: 'platinum', benefits: ['lounge'] }],
      pointsProgs: [{ program: 'star-alliance' }],
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown top-level keys (strict)', () => {
    expect(ProfileExtras.safeParse({ unknownKey: 'x' }).success).toBe(false);
  });
});

describe('TripContextExtras', () => {
  it('accepts an empty object', () => {
    expect(TripContextExtras.safeParse({}).success).toBe(true);
  });
  it('accepts accommodation', () => {
    expect(TripContextExtras.safeParse({ accommodation: 'hotel' }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to see it fail**

Run: `npm test -- profile-extras`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/profile-extras.ts`**

```ts
import { z } from 'zod';

export const ProfileExtras = z.object({
  cards: z.array(z.object({
    network: z.string(),
    tier: z.string(),
    benefits: z.array(z.string()).optional(),
  })).optional(),
  pointsProgs: z.array(z.object({
    program: z.string(),
    tier: z.string().optional(),
  })).optional(),
  dietary: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  mobility: z.array(z.string()).optional(),
}).strict();
export type ProfileExtras = z.infer<typeof ProfileExtras>;

export const TripContextExtras = z.object({
  accommodation: z.string().optional(),
}).strict();
export type TripContextExtras = z.infer<typeof TripContextExtras>;
```

- [ ] **Step 4: Run test, see it pass**

Run: `npm test -- profile-extras`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile-extras.ts tests/profile-extras.test.ts
git commit -m "Add ProfileExtras and TripContextExtras Zod schemas"
```

### Task 9: Conditions registry (`ROW_TYPES`)

**Files:**
- Create: `src/lib/conditions/registry.ts`
- Test: `tests/conditions/registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/conditions/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ROW_TYPES } from '@/lib/conditions/registry';

describe('ROW_TYPES.visa_exemption', () => {
  it('accepts a valid row', () => {
    const r = ROW_TYPES.visa_exemption.schema.safeParse({ exemptDays: 90, notes: 'tourist' });
    expect(r.success).toBe(true);
  });
  it('accepts exemptDays=null (visa required)', () => {
    expect(ROW_TYPES.visa_exemption.schema.safeParse({ exemptDays: null }).success).toBe(true);
  });
  it('rejects non-integer days', () => {
    expect(ROW_TYPES.visa_exemption.schema.safeParse({ exemptDays: 90.5 }).success).toBe(false);
  });
});

describe('ROW_TYPES.med_import', () => {
  it('requires three arrays', () => {
    expect(ROW_TYPES.med_import.schema.safeParse({
      allowed: [], permitRequired: [], banned: [],
    }).success).toBe(true);
  });
});

describe('ROW_TYPES.driving', () => {
  it('accepts a 1949 convention', () => {
    expect(ROW_TYPES.driving.schema.safeParse({ idpConvention: '1949' }).success).toBe(true);
  });
  it('rejects an unknown convention', () => {
    expect(ROW_TYPES.driving.schema.safeParse({ idpConvention: '1968-supplemental' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to see it fail**

Run: `npm test -- registry`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/conditions/registry.ts`**

```ts
import { z } from 'zod';

export const ROW_TYPES = {
  visa_exemption: {
    schema: z.object({
      exemptDays: z.number().int().nullable(),
      notes: z.string().optional(),
    }).strict(),
    keyFormat: 'citizenship:destination' as const,
    ttlDays: 180,
  },
  med_import: {
    schema: z.object({
      allowed: z.array(z.string()),
      permitRequired: z.array(z.string()),
      banned: z.array(z.string()),
      permitName: z.string().optional(),
    }).strict(),
    keyFormat: 'destination' as const,
    ttlDays: 90,
  },
  driving: {
    schema: z.object({
      idpConvention: z.enum(['1949', '1968']).nullable(),
      notes: z.string().optional(),
    }).strict(),
    keyFormat: 'destination' as const,
    ttlDays: 365,
  },
} as const;

export type RowType = keyof typeof ROW_TYPES;
export type RowOf<T extends RowType> = z.infer<typeof ROW_TYPES[T]['schema']>;
```

- [ ] **Step 4: Run test, see it pass**

Run: `npm test -- registry`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/conditions/registry.ts tests/conditions/registry.test.ts
git commit -m "Add conditions registry with 3 row types"
```

### Task 10: Seed file structure + first JP seeds

**Files:**
- Create: `src/data/conditions/visa_exemption/US:JP.yaml`
- Create: `src/data/conditions/med_import/JP.yaml`
- Create: `src/data/conditions/driving/JP.yaml`

- [ ] **Step 1: Create the seed YAML files**

`src/data/conditions/visa_exemption/US:JP.yaml`:

```yaml
exemptDays: 90
notes: "US passport holders visa-exempt up to 90 days for tourism."
```

`src/data/conditions/med_import/JP.yaml`:

```yaml
allowed:
  - "ibuprofen"
  - "acetaminophen"
permitRequired:
  - "amphetamines"
  - "methylphenidate"
banned:
  - "pseudoephedrine"
permitName: "Yakkan Shoumei"
```

`src/data/conditions/driving/JP.yaml`:

```yaml
idpConvention: "1949"
notes: "Japan accepts only 1949 Geneva convention IDPs."
```

- [ ] **Step 2: Commit**

```bash
git add src/data/conditions/
git commit -m "Seed JP visa, med-import, and driving rules"
```

### Task 11: Seed loader

**Files:**
- Create: `src/lib/conditions/seed.ts`
- Test: `tests/conditions/seed.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/conditions/seed.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to see it fail**

Run: `npm test -- seed`
Expected: FAIL — `loadSeedRows` not found.

- [ ] **Step 3: Implement `src/lib/conditions/seed.ts`**

```ts
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYAML } from 'yaml';
import { sql } from 'drizzle-orm';
import { conditionRow } from '@/lib/db/schema';
import { ROW_TYPES, type RowType } from './registry';

type AnyDb = {
  insert: typeof import('@/lib/db/client').db.insert;
  execute?: (q: any) => Promise<any>;
};

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
```

- [ ] **Step 4: Run test, see it pass**

Run: `npm test -- seed`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/conditions/seed.ts tests/conditions/seed.test.ts
git commit -m "Add seed loader for condition rows"
```

### Task 12: AI fallback scaffold

**Files:**
- Create: `src/lib/conditions/ai.ts`

- [ ] **Step 1: Read the AI SDK structured-output docs before writing this module.**

Reference: `https://sdk.vercel.ai/docs/reference/ai-sdk-core/generate-object`. Confirm the import is `import { generateObject } from 'ai'` and that `schema` accepts a Zod schema.

- [ ] **Step 2: Implement `src/lib/conditions/ai.ts`**

```ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { ROW_TYPES, type RowType, type RowOf } from './registry';

const Citation = z.object({
  url: z.string().url(),
  snippet: z.string().optional(),
  fetchedAt: z.string(),
});
export type Citation = z.infer<typeof Citation>;

export type AIRowResult<T extends RowType> = {
  data: RowOf<T>;
  confidence: 'high' | 'medium' | 'low';
  citations: Citation[];
};

const MODEL = process.env.CONDITIONS_AI_MODEL ?? 'anthropic/claude-opus-4-7';

export async function fetchRowViaAI<T extends RowType>(
  type: T,
  key: string,
): Promise<AIRowResult<T> | null> {
  const wrapped = ROW_TYPES[type].schema.and(z.object({
    confidence: z.enum(['high', 'medium', 'low']),
    citations: z.array(Citation),
  }));

  try {
    const { object } = await generateObject({
      model: MODEL,
      schema: wrapped,
      system: [
        'You produce structured factual answers about travel conditions between countries.',
        'Lower `confidence` if you are uncertain. Prefer authoritative sources (government, embassy, airline).',
        'If you cite a URL, include it in `citations`; use ISO timestamps in `fetchedAt`.',
      ].join(' '),
      prompt: `Return the ${type} row for key "${key}". Match the schema exactly.`,
    });

    const { confidence, citations, ...data } = object as any;
    return { data: data as RowOf<T>, confidence, citations };
  } catch (err) {
    console.error(`[conditions.ai] fetch failed for ${type}:${key}`, err);
    return null;
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/conditions/ai.ts
git commit -m "Add AI fallback scaffold for condition rows"
```

### Task 13: AI fallback test (mocked)

**Files:**
- Test: `tests/conditions/ai.test.ts`

- [ ] **Step 1: Write the test with `vi.mock` for the `ai` package**

Create `tests/conditions/ai.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

import { generateObject } from 'ai';
import { fetchRowViaAI } from '@/lib/conditions/ai';

const mockGen = generateObject as unknown as ReturnType<typeof vi.fn>;

describe('fetchRowViaAI', () => {
  beforeEach(() => { mockGen.mockReset(); });

  it('returns parsed row + confidence + citations on success', async () => {
    mockGen.mockResolvedValueOnce({
      object: {
        exemptDays: 30,
        confidence: 'high',
        citations: [{ url: 'https://example.gov/visa', fetchedAt: '2026-05-10T00:00:00Z' }],
      },
    });
    const r = await fetchRowViaAI('visa_exemption', 'US:XX');
    expect(r).not.toBeNull();
    expect(r!.data.exemptDays).toBe(30);
    expect(r!.confidence).toBe('high');
    expect(r!.citations).toHaveLength(1);
  });

  it('returns null on generateObject throwing', async () => {
    mockGen.mockRejectedValueOnce(new Error('gateway 500'));
    const r = await fetchRowViaAI('visa_exemption', 'US:XX');
    expect(r).toBeNull();
  });
});
```

- [ ] **Step 2: Run test**

Run: `npm test -- ai`
Expected: PASS, 2 tests.

- [ ] **Step 3: Commit**

```bash
git add tests/conditions/ai.test.ts
git commit -m "Test AI fallback success and failure paths"
```

### Task 14: `getRow` public API

**Files:**
- Create: `src/lib/conditions/index.ts`
- Test: `tests/conditions/get-row.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/conditions/get-row.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to see it fail**

Run: `npm test -- get-row`
Expected: FAIL — `getRow` not found.

- [ ] **Step 3: Implement `src/lib/conditions/index.ts`**

```ts
import { sql, and, eq } from 'drizzle-orm';
import { conditionRow } from '@/lib/db/schema';
import { db as defaultDb } from '@/lib/db/client';
import { ROW_TYPES, type RowType, type RowOf } from './registry';
import { fetchRowViaAI } from './ai';

export { ROW_TYPES };
export type { RowType, RowOf };

type DbLike = typeof defaultDb;

export async function getRow<T extends RowType>(
  type: T, key: string, opts: { db?: DbLike } = {},
): Promise<RowOf<T> | null> {
  const db = opts.db ?? defaultDb;
  const existing = await db
    .select().from(conditionRow)
    .where(and(eq(conditionRow.rowType, type), eq(conditionRow.rowKey, key)))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    const fresh = row.expiresAt === null || row.expiresAt > new Date();
    if (fresh) return row.data as RowOf<T>;
    // expired — fall through to AI, but remember as stale fallback
    const stale = row.data as RowOf<T>;
    const fetched = await fetchRowViaAI(type, key);
    if (!fetched) return stale;
    await upsertAIRow(db, type, key, fetched);
    return fetched.data;
  }

  const fetched = await fetchRowViaAI(type, key);
  if (!fetched) return null;
  await upsertAIRow(db, type, key, fetched);
  return fetched.data;
}

async function upsertAIRow<T extends RowType>(
  db: DbLike, type: T, key: string,
  fetched: { data: RowOf<T>; confidence: 'high'|'medium'|'low'; citations: any[] },
) {
  const ttl = ROW_TYPES[type].ttlDays;
  const expiresAt = new Date(Date.now() + ttl * 24 * 60 * 60 * 1000);
  await db.insert(conditionRow).values({
    rowType: type, rowKey: key,
    data: fetched.data as any,
    source: 'ai', confidence: fetched.confidence,
    citations: fetched.citations as any,
    expiresAt,
  }).onConflictDoUpdate({
    target: [conditionRow.rowType, conditionRow.rowKey],
    set: {
      data: fetched.data as any,
      source: 'ai',
      confidence: fetched.confidence,
      citations: fetched.citations as any,
      expiresAt, fetchedAt: sql`now()`,
    },
    where: eq(conditionRow.source, 'ai'),
  });
}
```

- [ ] **Step 4: Run test, see it pass**

Run: `npm test -- get-row`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/conditions/index.ts tests/conditions/get-row.test.ts
git commit -m "Add getRow with seed/cache/AI/stale flow"
```

---

## Phase C — Rule-layer integration

### Task 15: Bootstrap the rule layer types and Facts

**Files:**
- Create: `src/lib/rules/types.ts`
- Create: `src/lib/user-profile.ts` (stub types referenced by rule layer spec)

- [ ] **Step 1: Create `src/lib/user-profile.ts`** — typed shape that mirrors the DB tables. This file is consumed by the rule layer.

```ts
import type { ProfileExtras, TripContextExtras } from './profile-extras';

export type PermanentProfile = {
  userId: string;
  citizenships: string[];
  homeCountry: string | null;
  idpConvention: '1949' | '1968' | null;
  idpExpiry: string | null;          // ISO yyyy-mm-dd
  controlledMeds: string[];
  hasMinors: boolean;
  extras: ProfileExtras;
};

export type TripContext = {
  tripId: string;
  travelingWithMinors: boolean;
  drivingAtDestination: boolean;
  carryingControlledMeds: boolean;
  purpose: 'tourism' | 'business' | 'family' | 'study' | null;
  extras: TripContextExtras;
};
```

- [ ] **Step 2: Create `src/lib/rules/types.ts`** — per the rule-layer spec, extended with `tables`.

```ts
import type { RowOf, RowType } from '@/lib/conditions/registry';

export type Leg = {
  from: string; to: string;
  startDate: string; endDate: string;
};

export type Facts = {
  citizenships: string[];
  controlledMeds: string[];
  hasMinors: boolean;
  idp1949Valid: boolean;
  idp1968Valid: boolean;
  travelingWithMinors: boolean;
  drivingAtDestination: boolean;
  carryingControlledMeds: boolean;
  fromCountry: string;
  toCountry: string;
  stayDays: number;
  tables: { [K in RowType]?: Record<string, RowOf<K>> };
};

export type ResolvedChoice = {
  choiceId: string;
  ruleId: string;
  reason: string;
};

export type ResolverOutput = Record<string, ResolvedChoice>;
export type FlowResolver = (facts: Facts) => ResolverOutput;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/user-profile.ts src/lib/rules/types.ts
git commit -m "Add PermanentProfile/TripContext types and Facts with tables"
```

### Task 16: `buildFacts`

**Files:**
- Create: `src/lib/rules/facts.ts`
- Test: `tests/rules/facts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/rules/facts.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to see it fail**

Run: `npm test -- facts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/rules/facts.ts`**

```ts
import type { PermanentProfile, TripContext } from '@/lib/user-profile';
import type { Facts, Leg } from './types';
import type { RowOf, RowType } from '@/lib/conditions/registry';

type Hydrated = { tables?: { [K in RowType]?: Record<string, RowOf<K>> } };

export function buildFacts(
  profile: PermanentProfile,
  context: TripContext,
  leg: Leg,
  hydrated: Hydrated = {},
): Facts {
  const stayDays = daysBetween(leg.startDate, leg.endDate);
  const endMs = Date.parse(leg.endDate);
  const idpExpiryMs = profile.idpExpiry ? Date.parse(profile.idpExpiry) : -Infinity;
  const idpValid = idpExpiryMs >= endMs;

  return {
    citizenships: profile.citizenships,
    controlledMeds: profile.controlledMeds,
    hasMinors: profile.hasMinors,
    idp1949Valid: idpValid && profile.idpConvention === '1949',
    idp1968Valid: idpValid && profile.idpConvention === '1968',
    travelingWithMinors: context.travelingWithMinors,
    drivingAtDestination: context.drivingAtDestination,
    carryingControlledMeds: context.carryingControlledMeds,
    fromCountry: leg.from,
    toCountry: leg.to,
    stayDays,
    tables: hydrated.tables ?? {},
  };
}

function daysBetween(start: string, end: string): number {
  const s = Date.parse(start), e = Date.parse(end);
  return Math.max(0, Math.round((e - s) / 86_400_000));
}
```

- [ ] **Step 4: Run test, see it pass**

Run: `npm test -- facts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rules/facts.ts tests/rules/facts.test.ts
git commit -m "Add buildFacts with optional hydrated tables"
```

### Task 17: JP preflight resolver + registry with `requiredRows`

**Files:**
- Create: `src/lib/rules/jp/preflight.ts`
- Create: `src/lib/rules/index.ts`
- Test: `tests/rules/jp-preflight.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/rules/jp-preflight.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolvePreflightJP } from '@/lib/rules/jp/preflight';
import type { Facts } from '@/lib/rules/types';

function baseFacts(): Facts {
  return {
    citizenships: ['US'], controlledMeds: [], hasMinors: false,
    idp1949Valid: false, idp1968Valid: false,
    travelingWithMinors: false, drivingAtDestination: false, carryingControlledMeds: false,
    fromCountry: 'US', toCountry: 'JP', stayDays: 9,
    tables: { visa_exemption: { 'US:JP': { exemptDays: 90 } } },
  };
}

describe('resolvePreflightJP', () => {
  it('resolves n-visa=no for US passport + 9-night stay using table data', () => {
    const out = resolvePreflightJP(baseFacts());
    expect(out['n-visa'].choiceId).toBe('no');
    expect(out['n-visa'].ruleId).toBe('jp.preflight.visa.us-exempt');
  });

  it('does not resolve n-visa when no visa_exemption row present', () => {
    const f = baseFacts();
    f.tables = {};
    const out = resolvePreflightJP(f);
    expect(out['n-visa']).toBeUndefined();
  });

  it('resolves n-drive=yes when driving with valid 1949 IDP', () => {
    const f = baseFacts();
    f.drivingAtDestination = true;
    f.idp1949Valid = true;
    const out = resolvePreflightJP(f);
    expect(out['n-drive'].choiceId).toBe('yes');
  });

  it('leaves n-drive unresolved when driving without an IDP fact', () => {
    const f = baseFacts();
    f.drivingAtDestination = true;
    const out = resolvePreflightJP(f);
    expect(out['n-drive']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to see it fail**

Run: `npm test -- jp-preflight`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/rules/jp/preflight.ts`**

```ts
import type { FlowResolver, ResolverOutput } from '../types';

export const resolvePreflightJP: FlowResolver = (f): ResolverOutput => {
  const out: ResolverOutput = {};

  // n-visa — table-driven across citizenships
  for (const c of f.citizenships) {
    const visa = f.tables.visa_exemption?.[`${c}:${f.toCountry}`];
    if (visa && visa.exemptDays !== null && f.stayDays <= visa.exemptDays) {
      out['n-visa'] = {
        choiceId: 'no',
        ruleId:   `jp.preflight.visa.${c.toLowerCase()}-exempt`,
        reason:   `${c} passport, ${f.stayDays}-night stay → visa-exempt up to ${visa.exemptDays} days`,
      };
      break;
    }
  }

  // n-meds — same as rule layer spec
  if (f.carryingControlledMeds && f.controlledMeds.length > 0) {
    out['n-meds'] = {
      choiceId: 'yes-controlled',
      ruleId:   'jp.preflight.meds.controlled',
      reason:   `${f.controlledMeds.join(', ')} requires a Yakkan Shoumei import certificate`,
    };
  } else if (f.carryingControlledMeds === false) {
    out['n-meds'] = {
      choiceId: 'no',
      ruleId:   'jp.preflight.meds.none',
      reason:   'No prescription meds declared for this trip',
    };
  }

  // n-kids
  if (f.travelingWithMinors === false) {
    out['n-kids'] = {
      choiceId: 'no',
      ruleId:   'jp.preflight.kids.none',
      reason:   'No minors on this trip',
    };
  }

  // n-drive — IDP logic stays in TS
  if (f.drivingAtDestination === false) {
    out['n-drive'] = {
      choiceId: 'no',
      ruleId:   'jp.preflight.drive.no',
      reason:   'Not driving in Japan — trains only',
    };
  } else if (f.drivingAtDestination && f.idp1949Valid) {
    out['n-drive'] = {
      choiceId: 'yes',
      ruleId:   'jp.preflight.drive.idp1949',
      reason:   'Driving in Japan; you have a valid 1949-convention IDP',
    };
  }

  return out;
};
```

- [ ] **Step 4: Run test, see it pass**

Run: `npm test -- jp-preflight`
Expected: PASS, 4 tests.

- [ ] **Step 5: Implement `src/lib/rules/index.ts`** — registry with `requiredRows`.

```ts
import { resolvePreflightJP } from './jp/preflight';
import { buildFacts } from './facts';
import type { FlowResolver, Facts, Leg, ResolverOutput } from './types';
import type { RowType } from '@/lib/conditions/registry';
import type { PermanentProfile, TripContext } from '@/lib/user-profile';

export type FlowEntry = {
  resolver: FlowResolver;
  requiredRows: (facts: Facts) => Array<{ type: RowType; key: string }>;
};

export const REGISTRY: Record<string, FlowEntry> = {
  'preflight-jp': {
    resolver: resolvePreflightJP,
    requiredRows: (f) => [
      ...f.citizenships.map((c) => ({ type: 'visa_exemption' as const, key: `${c}:${f.toCountry}` })),
      { type: 'med_import' as const, key: f.toCountry },
      { type: 'driving' as const,    key: f.toCountry },
    ],
  },
};

export function resolveFlow(
  flowId: string,
  profile: PermanentProfile | null,
  context: TripContext | null,
  leg: Leg,
  hydrated: { tables?: Facts['tables'] } = {},
): ResolverOutput {
  if (!profile || !context) return {};
  const entry = REGISTRY[flowId];
  if (!entry) return {};
  try {
    return entry.resolver(buildFacts(profile, context, leg, hydrated));
  } catch (err) {
    console.error(`[rules] resolver for ${flowId} threw:`, err);
    return {};
  }
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/rules/jp/preflight.ts src/lib/rules/index.ts tests/rules/jp-preflight.test.ts
git commit -m "Add JP preflight resolver (table-driven visa) + flow registry"
```

### Task 18: `hydrateLeg`

**Files:**
- Create: `src/lib/conditions/readiness.ts`
- Test: `tests/conditions/readiness.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/conditions/readiness.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
```

- [ ] **Step 2: Run test to see it fail**

Run: `npm test -- readiness`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/conditions/readiness.ts`**

```ts
import { buildFacts } from '@/lib/rules/facts';
import { REGISTRY } from '@/lib/rules/index';
import { getRow } from './index';
import type { Facts, Leg } from '@/lib/rules/types';
import type { PermanentProfile, TripContext } from '@/lib/user-profile';
import type { RowType, RowOf } from './registry';
import { db as defaultDb } from '@/lib/db/client';

export type MissingRow = { type: RowType; key: string };
export type HydratedLeg = {
  facts: Facts;
  missing: MissingRow[];
};

export async function hydrateLeg(
  profile: PermanentProfile,
  context: TripContext,
  leg: Leg,
  opts: { flowId: string; db?: typeof defaultDb },
): Promise<HydratedLeg> {
  const db = opts.db ?? defaultDb;
  const skeletonFacts = buildFacts(profile, context, leg);
  const entry = REGISTRY[opts.flowId];
  if (!entry) {
    return { facts: skeletonFacts, missing: [] };
  }
  const required = entry.requiredRows(skeletonFacts);
  const resolved = await Promise.all(
    required.map((r) => getRow(r.type, r.key, { db }).then((data) => ({ ...r, data }))),
  );
  const tables: Facts['tables'] = {};
  const missing: MissingRow[] = [];
  for (const r of resolved) {
    if (r.data === null) {
      missing.push({ type: r.type, key: r.key });
      continue;
    }
    const bucket = (tables[r.type] ??= {} as Record<string, RowOf<typeof r.type>>);
    (bucket as any)[r.key] = r.data;
  }
  return { facts: buildFacts(profile, context, leg, { tables }), missing };
}
```

- [ ] **Step 4: Run test, see it pass**

Run: `npm test -- readiness`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/conditions/readiness.ts tests/conditions/readiness.test.ts
git commit -m "Add hydrateLeg with per-flow required-row fetching"
```

### Task 19: End-to-end resolution test

**Files:**
- Test: `tests/leg-resolution.test.ts`

- [ ] **Step 1: Write the integration test**

Create `tests/leg-resolution.test.ts`:

```ts
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
      userId: 'u1', citizenships: ['US'], homeCountry: 'US',
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
```

- [ ] **Step 2: Run test**

Run: `npm test -- leg-resolution`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/leg-resolution.test.ts
git commit -m "End-to-end test: US→JP 9-night auto-resolves all 4 nodes"
```

### Task 20: Wire `FlowGraphView` to hydrate on flow open

**Files:**
- Modify: `src/lib/use-trip-store.ts` (add `applyResolution` action + `flowResolved`/`flowOverrides` state — minimal version)
- Modify: `src/components/destify/flow-modal.tsx` (or wherever `FlowGraphView` lives)

- [ ] **Step 1: Read the trip store + flow-modal files to locate the integration point.**

```bash
grep -n "FlowGraphView\|flowChoices\|setFlowChoice" src/lib/use-trip-store.ts src/components/destify/flow-modal.tsx
```

- [ ] **Step 2: Add `applyResolution` action and supporting state to `src/lib/use-trip-store.ts`.**

Add to the `State` type:

```ts
flowResolved: Record<string, Record<string, { choiceId: string; ruleId: string; reason: string }>>;
flowOverrides: Record<string, Record<string, string>>;
```

Add to the initial state (alongside `flowChoices`):

```ts
flowResolved: {},
flowOverrides: {},
```

Add the action (alongside `setFlowChoice`):

```ts
applyResolution: (flowId, output) => set((s) => {
  const overrides = s.flowOverrides[flowId] ?? {};
  const newChoices = { ...s.flowChoices };
  for (const [nodeId, resolved] of Object.entries(output)) {
    newChoices[nodeId] = overrides[nodeId] ?? resolved.choiceId;
  }
  return {
    flowChoices: newChoices,
    flowResolved: { ...s.flowResolved, [flowId]: output },
  };
}),
```

Type signature on the `Actions` type:

```ts
applyResolution: (flowId: string, output: Record<string, { choiceId: string; ruleId: string; reason: string }>) => void;
```

- [ ] **Step 3: In `flow-modal.tsx`, add the hydration effect inside `FlowGraphView`.**

Find the existing `useEffect` that depends on `flow.id` (or the equivalent open-flow trigger). Add:

```ts
import { hydrateLeg } from '@/lib/conditions/readiness';
import { resolveFlow } from '@/lib/rules/index';

// Inside FlowGraphView, after locating the active leg + profile + context:
useEffect(() => {
  let cancelled = false;
  (async () => {
    if (!profile || !context || !activeLeg) return;
    const { facts, missing } = await hydrateLeg(profile, context, activeLeg, { flowId: flow.id });
    if (cancelled) return;
    const output = resolveFlow(flow.id, profile, context, activeLeg, { tables: facts.tables });
    applyResolution(flow.id, output);
    setMissing(missing);
  })();
  return () => { cancelled = true; };
}, [flow.id, profile, context, activeLeg]);
```

- [ ] **Step 4: Stub `profile`, `context`, `activeLeg` if they are not yet derived from the store.**

For this task, hard-code a US/JP/9-night demo:

```ts
const profile: PermanentProfile = {
  userId: 'demo', citizenships: ['US'], homeCountry: 'US',
  idpConvention: null, idpExpiry: null,
  controlledMeds: [], hasMinors: false, extras: {},
};
const context: TripContext = {
  tripId: 'demo', travelingWithMinors: false, drivingAtDestination: false,
  carryingControlledMeds: false, purpose: 'tourism', extras: {},
};
const activeLeg: Leg = { from: 'US', to: 'JP', startDate: '2026-06-01', endDate: '2026-06-10' };
```

The "real" profile/context/leg wiring belongs to a separate UI spec (onboarding + trip-context capture). For now, hard-coding the demo is correct and lets us see the auto-resolution working end-to-end.

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run the dev server**

Run: `npm run dev` (in a second terminal).
Open `http://localhost:3000/organizer` in the browser.
Open the preflight checklist.
Expected: the `n-visa` node renders with `no` selected automatically. The "From your profile" badge does **not** render yet (that's a separate UI task — out of scope here).

- [ ] **Step 7: Commit**

```bash
git add src/lib/use-trip-store.ts src/components/destify/flow-modal.tsx
git commit -m "Wire FlowGraphView to hydrate conditions and auto-resolve on open"
```

### Task 21: Seed-on-boot once (deployed env)

**Files:**
- Create: `scripts/seed-conditions.ts`

- [ ] **Step 1: Create the seed-runner script**

Create `scripts/seed-conditions.ts`:

```ts
import 'dotenv/config';
import { db } from '@/lib/db/client';
import { loadSeedRows } from '@/lib/conditions/seed';

async function main() {
  const result = await loadSeedRows(db);
  console.log(`Seeded ${result.count} condition rows.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it once against Neon**

Run: `npx tsx scripts/seed-conditions.ts`
Expected: `Seeded 3 condition rows.`

- [ ] **Step 3: Verify in Neon**

Run: `npx tsx -e "import { db } from '@/lib/db/client'; import { conditionRow } from '@/lib/db/schema'; const r = await db.select().from(conditionRow); console.log(r.length); process.exit(0);"`
Expected: prints `3`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-conditions.ts
git commit -m "Add seed-conditions runner script for deployed env"
```

---

## Verification (post-implementation)

- [ ] **V1.** `npm test` — all suites pass.
- [ ] **V2.** `npx tsc --noEmit` — no type errors.
- [ ] **V3.** `npm run lint` — no new lint errors.
- [ ] **V4.** Browser smoke: open `http://localhost:3000/organizer`, open the preflight flow, confirm `n-visa` auto-resolves to `no` without clicking.
- [ ] **V5.** Manually delete the `visa_exemption:US:JP` row in Neon and reopen the flow with `CONDITIONS_AI_MODEL` unset and Gateway unreachable. Confirm the modal still opens, `n-visa` is left unresolved, and the user can still answer manually.

---

## Out of scope (explicitly deferred)

- The "From your profile" provenance badge UI on resolved nodes. UI work, separate small PR.
- The re-sync hint when a user override disagrees with current resolution. UI work, separate small PR.
- Auth provider and a real `users` table population path. Separate spec.
- Onboarding UI for capturing the PermanentProfile fields. Separate spec.
- Trip and Leg CRUD UI. Separate spec.
- TripContext editing UI. Separate spec.
- Planner-mode tables (`leg_option`, `deal_comparison`, point/card tracking). Separate spec.
- Background staleness refresh job. Lazy refresh on access is v1 behavior.
- Cross-citizenship optimization for dual citizens (best-passport-per-leg heuristic).
- Visual treatment of cascading child nodes on later legs. Data supports it; UI work is downstream.
