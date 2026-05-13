# Info-card profile-driven content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make auto-resolved info-kind rectangle cards in flow modals (starting with `n-pass` on preflight-jp) derive their content from the session profile, and reshape the profile to keep "who you are and where you live" cleanly isolated from per-trip data.

**Architecture:** Split `ResolverOutput` into `{ choices, info }` so resolvers can emit per-node info content alongside decisions. Mirror that split in the Zustand store with a new `flowInfo` map (same stale-clear discipline as `flowResolved` from #8). Reshape `PermanentProfile`: embed `passportExpiry` in each citizenship entry, and replace `homeCountry` with `residence: { country, visaStatus? }`. `RectNode` reads from `flowInfo` and falls back to static `trip-data.ts` content. A hand-written Drizzle migration reshapes existing profile rows.

**Tech Stack:** Next.js 16 App Router (Server Actions), Drizzle ORM (neon-http in prod, pglite in tests), Zustand store, Zod, native Date math (date-fns is NOT a dependency), Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-12-info-cards-design.md`](../specs/2026-05-12-info-cards-design.md)

**Related issues:** Fixes #14. Filed out-of-scope: #15 (layover/via), #16 (multi-citizenship picker), #17 (residence visaStatus consumers), #18 (state='fail' visual polish).

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| `src/lib/db/schema.ts` | Modify | Drizzle table definitions: replace `home_country` with `residence_country`+`residence_visa_status`; replace `citizenships text[]` with `citizenships jsonb`. |
| `drizzle/0001_info_cards.sql` | Create | Hand-written migration: add new columns, backfill from old, drop old, rename new citizenships. |
| `drizzle/meta/_journal.json` | Modify | Register migration entry. |
| `src/lib/user-profile.ts` | Modify | TS type: `citizenships: {country, passportExpiry}[]`, `residence: {country, visaStatus?} \| null`. |
| `src/lib/profile-schemas.ts` | Modify | Zod `Tier1ProfileInput` with new shape. |
| `src/lib/profile-db.ts` | Modify | `loadProfile` and `saveProfile` read/write the new columns. |
| `src/lib/conditions/actions.ts` | Modify | `DEFAULT_PROFILE` shape; `resolveFlow`'s return type matches new `ResolverOutput`. |
| `src/lib/rules/types.ts` | Modify | `ResolverOutput → { choices, info }`, new `ResolvedInfo`, `Facts` gets new fields. |
| `src/lib/rules/facts.ts` | Modify | `buildFacts` emits new `Facts` shape. |
| `src/lib/rules/index.ts` | Modify | `resolveFlow` returns new shape; REGISTRY uses `c.country`. |
| `src/lib/rules/jp/preflight.ts` | Modify | Existing decisions go in `out.choices`; new `n-pass` branch in `out.info` (four cases). |
| `src/lib/use-trip-store.ts` | Modify | Add `flowInfo` map; `applyResolution` accepts `{ choices, info }`, writes both, stale-clear semantics. |
| `src/components/destify/flow-modal.tsx` | Modify | Destructure `output.choices/info`; `RectNode` reads `flowInfo` with fallback; warn dot for state `warn`/`fail`. |
| `src/lib/trip-data.ts` | Modify | Replace `n-pass` hardcoded "US Passport · valid Aug 2029" copy with neutral fallback "Identity · pending". |
| `src/app/onboarding/wizard.tsx` | Modify (Task 1, then Task 6) | Task 1: type-coerce existing inputs to new shape on save. Task 6: real per-citizenship expiry input + residence visa-status select. |
| `src/app/profile/form.tsx` | Modify (Task 1, then Task 7) | Same dual phase. |
| `tests/preflight-resolver.test.ts` | Create | Unit tests for `n-pass` resolver: pass, no-expiry warn, no-citizenship warn, expires-too-soon fail. |
| `tests/profile-resolution.test.ts` | Modify | Update saveProfile call shapes; assert `output.choices` and `output.info`. |
| `tests/store-resolution.test.ts` | Modify | Extend with `flowInfo` round-trip and stale-clear cases. |
| `tests/profile-schemas.test.ts` | Modify | New shape parse tests; old shape rejects. |
| `tests/leg-resolution.test.ts` | Modify | Update `PermanentProfile` literals and `ResolverOutput` destructure. |

---

## Task 1: Profile schema reshape (DB → types → zod → callers)

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `drizzle/0001_info_cards.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `src/lib/user-profile.ts`
- Modify: `src/lib/profile-schemas.ts`
- Modify: `src/lib/profile-db.ts`
- Modify: `src/lib/conditions/actions.ts` (DEFAULT_PROFILE only)
- Modify: `src/app/onboarding/wizard.tsx` (save-payload coercion only)
- Modify: `src/app/profile/form.tsx` (save-payload coercion only)
- Modify: `tests/profile-schemas.test.ts`
- Modify: `tests/profile-resolution.test.ts` (saveProfile call shapes only)
- Modify: `tests/leg-resolution.test.ts` (PermanentProfile literal only)

This is the foundation task. Atomic because TypeScript won't compile otherwise.

- [ ] **Step 1: Write failing tests for the new Tier1ProfileInput shape**

Replace the entire body of `tests/profile-schemas.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- profile-schemas`
Expected: FAIL (current `Tier1ProfileInput` still expects `citizenships: string[]` and `homeCountry`).

- [ ] **Step 3: Update PermanentProfile TypeScript type**

Replace the entire contents of `src/lib/user-profile.ts` with:

```ts
import type { ProfileExtras, TripContextExtras } from './profile-extras';

export type Citizenship = {
  country: string;            // ISO alpha-2
  passportExpiry: string | null;  // ISO yyyy-mm-dd or null
};

export type Residence = {
  country: string;            // ISO alpha-2
  visaStatus: 'tourist' | 'permanent' | 'digital-nomad' | 'work' | 'other' | null;
};

export type PermanentProfile = {
  userId: string;
  citizenships: Citizenship[];
  residence: Residence | null;
  idpConvention: '1949' | '1968' | null;
  idpExpiry: string | null;
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

- [ ] **Step 4: Update Tier1ProfileInput Zod schema**

Replace the entire contents of `src/lib/profile-schemas.ts` with:

```ts
import { z } from 'zod';
import { ProfileExtras, TripContextExtras } from '@/lib/profile-extras';

export const CitizenshipInput = z.object({
  country:        z.string().length(2),
  passportExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
}).strict();

export const ResidenceInput = z.object({
  country:    z.string().length(2),
  visaStatus: z.enum(['tourist', 'permanent', 'digital-nomad', 'work', 'other']).nullable(),
}).strict();

export const Tier1ProfileInput = z.object({
  citizenships:   z.array(CitizenshipInput),
  residence:      ResidenceInput.nullable(),
  idpConvention:  z.enum(['1949', '1968']).nullable(),
  idpExpiry:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  controlledMeds: z.array(z.string().min(1)),
  hasMinors:      z.boolean(),
  extras:         ProfileExtras.optional(),
}).strict();

export const TripContextInput = z.object({
  travelingWithMinors:    z.boolean(),
  drivingAtDestination:   z.boolean(),
  carryingControlledMeds: z.boolean(),
  purpose:                z.enum(['tourism', 'business', 'family', 'study']).nullable(),
  extras:                 TripContextExtras.optional(),
}).strict();
```

- [ ] **Step 5: Update Drizzle schema**

In `src/lib/db/schema.ts`, replace the `permanentProfile` table definition (lines 11–21) with:

```ts
export const permanentProfile = pgTable('permanent_profile', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  citizenships: jsonb('citizenships').$type<{ country: string; passportExpiry: string | null }[]>().notNull().default([]),
  residenceCountry: text('residence_country'),
  residenceVisaStatus: text('residence_visa_status'),
  idpConvention: idpConvention('idp_convention'),
  idpExpiry: date('idp_expiry'),
  controlledMeds: text('controlled_meds').array().notNull().default([]),
  hasMinors: boolean('has_minors').notNull().default(false),
  extras: jsonb('extras').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 6: Write the migration SQL**

Create `drizzle/0001_info_cards.sql` with:

```sql
ALTER TABLE "permanent_profile" ADD COLUMN "residence_country" text;--> statement-breakpoint
ALTER TABLE "permanent_profile" ADD COLUMN "residence_visa_status" text;--> statement-breakpoint
ALTER TABLE "permanent_profile" ADD COLUMN "citizenships_v2" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
UPDATE "permanent_profile" SET "residence_country" = "home_country" WHERE "home_country" IS NOT NULL;--> statement-breakpoint
UPDATE "permanent_profile" SET "citizenships_v2" = COALESCE((SELECT jsonb_agg(jsonb_build_object('country', c, 'passportExpiry', NULL)) FROM unnest("citizenships") AS c), '[]'::jsonb);--> statement-breakpoint
ALTER TABLE "permanent_profile" DROP COLUMN "home_country";--> statement-breakpoint
ALTER TABLE "permanent_profile" DROP COLUMN "citizenships";--> statement-breakpoint
ALTER TABLE "permanent_profile" RENAME COLUMN "citizenships_v2" TO "citizenships";
```

- [ ] **Step 7: Register the migration in the journal**

Replace `drizzle/meta/_journal.json` with:

```json
{
  "version": "7",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "7",
      "when": 1778483465424,
      "tag": "0000_init",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "7",
      "when": 1778483465425,
      "tag": "0001_info_cards",
      "breakpoints": true
    }
  ]
}
```

- [ ] **Step 8: Update profile-db.ts to read/write the new shape**

Replace `src/lib/profile-db.ts` with:

```ts
import 'server-only';

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { permanentProfile, tripContext, trip } from '@/lib/db/schema';
import { ProfileExtras, TripContextExtras } from '@/lib/profile-extras';
import { Tier1ProfileInput, TripContextInput } from '@/lib/profile-schemas';
import type { PermanentProfile, TripContext, Residence } from '@/lib/user-profile';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

function readResidence(country: string | null, status: string | null): Residence | null {
  if (!country) return null;
  const allowed = ['tourist', 'permanent', 'digital-nomad', 'work', 'other'] as const;
  const visaStatus = status && (allowed as readonly string[]).includes(status)
    ? (status as Residence['visaStatus'])
    : null;
  return { country, visaStatus };
}

export async function loadProfile(db: AnyDb, userId: string): Promise<PermanentProfile | null> {
  const rows = await db.select().from(permanentProfile).where(eq(permanentProfile.userId, userId));
  if (rows.length === 0) return null;
  const r = rows[0];
  const parsedExtras = ProfileExtras.safeParse(r.extras);
  return {
    userId: r.userId,
    citizenships: Array.isArray(r.citizenships) ? r.citizenships : [],
    residence: readResidence(r.residenceCountry, r.residenceVisaStatus),
    idpConvention: r.idpConvention,
    idpExpiry: r.idpExpiry,
    controlledMeds: r.controlledMeds ?? [],
    hasMinors: r.hasMinors,
    extras: parsedExtras.success ? parsedExtras.data : {},
  };
}

export async function saveProfile(db: AnyDb, userId: string, input: z.input<typeof Tier1ProfileInput>): Promise<void> {
  const parsed = Tier1ProfileInput.parse(input);
  const values = {
    userId,
    citizenships: parsed.citizenships,
    residenceCountry: parsed.residence?.country ?? null,
    residenceVisaStatus: parsed.residence?.visaStatus ?? null,
    idpConvention: parsed.idpConvention,
    idpExpiry: parsed.idpExpiry,
    controlledMeds: parsed.controlledMeds,
    hasMinors: parsed.hasMinors,
    extras: parsed.extras ?? {},
  };
  await db.insert(permanentProfile).values(values).onConflictDoUpdate({
    target: permanentProfile.userId,
    set: {
      citizenships: values.citizenships,
      residenceCountry: values.residenceCountry,
      residenceVisaStatus: values.residenceVisaStatus,
      idpConvention: values.idpConvention,
      idpExpiry: values.idpExpiry,
      controlledMeds: values.controlledMeds,
      hasMinors: values.hasMinors,
      extras: values.extras,
      updatedAt: new Date(),
    },
  });
}

export async function assertTripOwned(db: AnyDb, userId: string, tripId: string): Promise<void> {
  const rows = await db.select({ id: trip.id }).from(trip).where(and(eq(trip.id, tripId), eq(trip.userId, userId)));
  if (rows.length === 0) throw new Error('Forbidden');
}

export async function loadTripContext(db: AnyDb, tripId: string): Promise<TripContext | null> {
  const rows = await db.select().from(tripContext).where(eq(tripContext.tripId, tripId));
  if (rows.length === 0) return null;
  const r = rows[0];
  const parsedExtras = TripContextExtras.safeParse(r.extras);
  return {
    tripId: r.tripId,
    travelingWithMinors: r.travelingWithMinors,
    drivingAtDestination: r.drivingAtDestination,
    carryingControlledMeds: r.carryingControlledMeds,
    purpose: r.purpose,
    extras: parsedExtras.success ? parsedExtras.data : {},
  };
}

export async function saveTripContext(db: AnyDb, userId: string, tripId: string, input: z.input<typeof TripContextInput>): Promise<void> {
  await assertTripOwned(db, userId, tripId);
  const parsed = TripContextInput.parse(input);
  await db.insert(tripContext).values({
    tripId,
    travelingWithMinors: parsed.travelingWithMinors,
    drivingAtDestination: parsed.drivingAtDestination,
    carryingControlledMeds: parsed.carryingControlledMeds,
    purpose: parsed.purpose,
    extras: parsed.extras ?? {},
  }).onConflictDoUpdate({
    target: tripContext.tripId,
    set: {
      travelingWithMinors: parsed.travelingWithMinors,
      drivingAtDestination: parsed.drivingAtDestination,
      carryingControlledMeds: parsed.carryingControlledMeds,
      purpose: parsed.purpose,
      extras: parsed.extras ?? {},
      updatedAt: new Date(),
    },
  });
}
```

- [ ] **Step 9: Update DEFAULT_PROFILE in conditions/actions.ts**

In `src/lib/conditions/actions.ts`, replace the `DEFAULT_PROFILE` constant (lines 16–25) with:

```ts
const DEFAULT_PROFILE = (userId: string): PermanentProfile => ({
  userId,
  citizenships: [],
  residence: null,
  idpConvention: null,
  idpExpiry: null,
  controlledMeds: [],
  hasMinors: false,
  extras: {},
});
```

- [ ] **Step 10: Coerce wizard's save payload to the new shape (minimal change)**

In `src/app/onboarding/wizard.tsx`, replace the `save` function (lines 32–48) with:

```ts
  const save = (next: Tier1, after: () => void) => {
    startTransition(async () => {
      try {
        await saveProfileAction({
          citizenships: next.citizenships.map((c) => ({ country: c, passportExpiry: null })),
          residence: next.homeCountry ? { country: next.homeCountry, visaStatus: null } : null,
          idpConvention: next.drivesAbroad ? next.idpConvention : null,
          idpExpiry: next.drivesAbroad ? next.idpExpiry : null,
          controlledMeds: next.controlledMeds,
          hasMinors: next.hasMinors,
        });
        after();
      } catch {
        toast("Couldn't save — please retry");
      }
    });
  };
```

Leave the rest of `wizard.tsx` (its local `Tier1` type still uses `citizenships: string[]` and `homeCountry`) unchanged. Task 6 will overhaul the UI.

- [ ] **Step 11: Coerce profile form's save payload to the new shape**

In `src/app/profile/form.tsx`, replace the `useState` initializers and `save` function block (lines 20–40) with:

```ts
  const [c, setC] = useState<string[]>(initial?.citizenships.map((x) => x.country) ?? []);
  const [home, setHome] = useState<string | null>(initial?.residence?.country ?? null);
  const [conv, setConv] = useState<'1949' | '1968' | null>(initial?.idpConvention ?? null);
  const [expiry, setExpiry] = useState<string | null>(initial?.idpExpiry ?? null);
  const [meds, setMeds] = useState<string[]>(initial?.controlledMeds ?? []);
  const [hasMinors, setHasMinors] = useState<boolean>(initial?.hasMinors ?? false);
  const [medDraft, setMedDraft] = useState('');
  const [pending, startTransition] = useTransition();

  const save = () => startTransition(async () => {
    try {
      await saveProfileAction({
        citizenships: c.map((country) => ({ country, passportExpiry: null })),
        residence: home ? { country: home, visaStatus: null } : null,
        idpConvention: conv, idpExpiry: expiry,
        controlledMeds: meds, hasMinors,
      });
      toast('Profile saved');
    } catch {
      toast("Couldn't save — please retry");
    }
  });
```

Leave the rest of `form.tsx` unchanged for now. Task 7 will add per-citizenship expiry inputs and visa-status select.

- [ ] **Step 12: Update saveProfile calls in tests/profile-resolution.test.ts**

In `tests/profile-resolution.test.ts`, replace every `saveProfile(db, userId, {...})` block with the new shape:

```ts
    await saveProfile(db, userId, {
      citizenships: [{ country: 'US', passportExpiry: '2029-08-15' }],
      residence: { country: 'US', visaStatus: null },
      idpConvention: null, idpExpiry: null,
      controlledMeds: [], hasMinors: false,
    });
```

And for the KE variants:

```ts
    await saveProfile(db, userId, {
      citizenships: [{ country: 'KE', passportExpiry: null }],
      residence: { country: 'KE', visaStatus: null },
      idpConvention: null, idpExpiry: null,
      controlledMeds: [], hasMinors: false,
    });
```

- [ ] **Step 13: Update PermanentProfile literal in tests/leg-resolution.test.ts**

In `tests/leg-resolution.test.ts`, replace the profile literal:

```ts
    const profile: PermanentProfile = {
      userId: 'u1',
      citizenships: [{ country: 'US', passportExpiry: '2029-08-15' }],
      residence: { country: 'US', visaStatus: null },
      idpConvention: null, idpExpiry: null,
      controlledMeds: [], hasMinors: false, extras: {},
    };
```

- [ ] **Step 14: Run profile-schemas tests to verify they pass**

Run: `npm test -- profile-schemas`
Expected: PASS (all assertions in the new test body green).

- [ ] **Step 15: Run full suite to confirm transitive callers compile and pass**

Run: `npm test`
Expected: PASS. Some tests may still rely on the old `ResolverOutput` flat shape — that's fine, this task only reshapes the profile, not the resolver output. Those failures (if any) belong to Task 2. If a test fails *only* because of `Tier1ProfileInput` or `PermanentProfile` shape mismatch, fix it inline in this task. Tests failing because of `out['n-visa']` direct access stay broken — leave them; Task 2 fixes that.

If TypeScript fails to compile because some other file references `homeCountry` or the old citizenships shape, grep for it (`grep -rn "homeCountry\|citizenships:" src/`) and update each callsite to use `residence` / new citizenship shape.

- [ ] **Step 16: Commit**

```bash
git add src/lib/db/schema.ts drizzle/0001_info_cards.sql drizzle/meta/_journal.json \
        src/lib/user-profile.ts src/lib/profile-schemas.ts src/lib/profile-db.ts \
        src/lib/conditions/actions.ts \
        src/app/onboarding/wizard.tsx src/app/profile/form.tsx \
        tests/profile-schemas.test.ts tests/profile-resolution.test.ts tests/leg-resolution.test.ts
git commit -m "Reshape profile: citizenships embed passport expiry, homeCountry → residence

Schema migration: add residence_country, residence_visa_status, convert
citizenships from text[] to jsonb of {country, passportExpiry}. Wizard
and form coerce to the new shape on save; full UI editing of the new
fields lands in later tasks.

Issue #14."
```

---

## Task 2: ResolverOutput split + Facts reshape

**Files:**
- Modify: `src/lib/rules/types.ts`
- Modify: `src/lib/rules/facts.ts`
- Modify: `src/lib/rules/index.ts`
- Modify: `src/lib/rules/jp/preflight.ts`
- Modify: `src/lib/conditions/actions.ts`
- Modify: `src/lib/use-trip-store.ts` (just `applyResolution` parameter type — full flowInfo wiring lands in Task 4)
- Modify: `src/components/destify/flow-modal.tsx` (destructure `output.choices` for `applyResolution` — RectNode flowInfo lands in Task 5)
- Modify: `tests/leg-resolution.test.ts`
- Modify: `tests/profile-resolution.test.ts`
- Modify: `tests/store-resolution.test.ts` (existing tests adjust to new `applyResolution` argument shape)

- [ ] **Step 1: Update existing tests to expect the new `output.choices` shape**

In `tests/leg-resolution.test.ts`, replace the resolveFlow assertions block with:

```ts
    const out = resolveFlow('preflight-jp', profile, context, leg, { tables: facts.tables });

    expect(out.choices['n-visa'].choiceId).toBe('no');
    expect(out.choices['n-visa'].ruleId).toBe('jp.preflight.visa.us-exempt');
    expect(out.choices['n-meds'].choiceId).toBe('no');
    expect(out.choices['n-kids'].choiceId).toBe('no');
    expect(out.choices['n-drive'].choiceId).toBe('no');
    expect(out.info).toEqual({});  // No info nodes emitted yet — Task 3 adds n-pass
```

In `tests/profile-resolution.test.ts`, change every `output['n-visa']` to `output.choices['n-visa']`. There are four occurrences (one in each `it` block, plus two in the flipping-citizenship test).

In `tests/store-resolution.test.ts`, every `applyResolution(flowId, { 'node-id': {...} })` call must change to `applyResolution(flowId, { choices: { 'node-id': {...} }, info: {} })`. There are five calls in that file — update each.

- [ ] **Step 2: Run failing tests**

Run: `npm test`
Expected: FAIL. Errors include `Property 'choices' does not exist on type 'ResolverOutput'` and TS compile errors. Many existing tests will now fail — that's expected and gets fixed by the implementation steps.

- [ ] **Step 3: Update ResolverOutput, ResolvedInfo, and Facts types**

Replace the entire contents of `src/lib/rules/types.ts` with:

```ts
import type { RowOf, RowType } from '@/lib/conditions/registry';
import type { Citizenship, Residence } from '@/lib/user-profile';

export type Leg = {
  from: string; to: string;
  startDate: string; endDate: string;
};

export type Facts = {
  citizenships: Citizenship[];
  residence: Residence | null;
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
  leg: Leg;
  tables: { [K in RowType]?: Record<string, RowOf<K>> };
};

export type ResolvedChoice = {
  choiceId: string;
  ruleId: string;
  reason: string;
};

export type ResolvedInfo = {
  title: string;
  desc: string;
  meta?: string;
  state: 'pass' | 'warn' | 'fail';
  ruleId: string;
  reason: string;
};

export type ResolverOutput = {
  choices: Record<string, ResolvedChoice>;
  info:    Record<string, ResolvedInfo>;
};

export type FlowResolver = (facts: Facts) => ResolverOutput;
```

- [ ] **Step 4: Update buildFacts to emit the new shape**

Replace the entire contents of `src/lib/rules/facts.ts` with:

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
    residence: profile.residence,
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
    leg,
    tables: hydrated.tables ?? {},
  };
}

function daysBetween(start: string, end: string): number {
  const s = Date.parse(start), e = Date.parse(end);
  return Math.max(0, Math.round((e - s) / 86_400_000));
}
```

- [ ] **Step 5: Update REGISTRY and resolveFlow in rules/index.ts**

Replace the entire contents of `src/lib/rules/index.ts` with:

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

const EMPTY_OUTPUT: ResolverOutput = { choices: {}, info: {} };

export const REGISTRY: Record<string, FlowEntry> = {
  'preflight-jp': {
    resolver: resolvePreflightJP,
    requiredRows: (f) => [
      ...f.citizenships.map((c) => ({ type: 'visa_exemption' as const, key: `${c.country}:${f.toCountry}` })),
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
  if (!profile || !context) return { choices: {}, info: {} };
  const entry = REGISTRY[flowId];
  if (!entry) return { choices: {}, info: {} };
  try {
    return entry.resolver(buildFacts(profile, context, leg, hydrated));
  } catch (err) {
    console.error(`[rules] resolver for ${flowId} threw:`, err);
    return { choices: {}, info: {} };
  }
}

export const FLOW_LEG_SEQ: Record<string, number> = {
  'preflight-jp': 0,
  'domestic-jp':  1,
  'return-jp':    2,
};

export function legSeqForFlow(flowId: string): number | null {
  return FLOW_LEG_SEQ[flowId] ?? null;
}

// Re-exported for callers that want to seed an empty output without recreating the shape.
export { EMPTY_OUTPUT };
```

- [ ] **Step 6: Update preflight.ts to write decisions into out.choices**

Replace the entire contents of `src/lib/rules/jp/preflight.ts` with:

```ts
import type { FlowResolver, ResolverOutput } from '../types';

export const resolvePreflightJP: FlowResolver = (f): ResolverOutput => {
  const out: ResolverOutput = { choices: {}, info: {} };

  // n-visa — table-driven across citizenships
  for (const c of f.citizenships) {
    const visa = f.tables.visa_exemption?.[`${c.country}:${f.toCountry}`];
    if (visa && visa.exemptDays !== null && f.stayDays <= visa.exemptDays) {
      out.choices['n-visa'] = {
        choiceId: 'no',
        ruleId:   `jp.preflight.visa.${c.country.toLowerCase()}-exempt`,
        reason:   `${c.country} passport, ${f.stayDays}-night stay → visa-exempt up to ${visa.exemptDays} days`,
      };
      break;
    }
  }

  // n-meds
  if (f.carryingControlledMeds && f.controlledMeds.length > 0) {
    out.choices['n-meds'] = {
      choiceId: 'yes-controlled',
      ruleId:   'jp.preflight.meds.controlled',
      reason:   `${f.controlledMeds.join(', ')} requires a Yakkan Shoumei import certificate`,
    };
  } else if (f.carryingControlledMeds === false) {
    out.choices['n-meds'] = {
      choiceId: 'no',
      ruleId:   'jp.preflight.meds.none',
      reason:   'No prescription meds declared for this trip',
    };
  }

  // n-kids
  if (f.travelingWithMinors === false) {
    out.choices['n-kids'] = {
      choiceId: 'no',
      ruleId:   'jp.preflight.kids.none',
      reason:   'No minors on this trip',
    };
  }

  // n-drive — IDP logic
  if (f.drivingAtDestination === false) {
    out.choices['n-drive'] = {
      choiceId: 'no',
      ruleId:   'jp.preflight.drive.no',
      reason:   'Not driving in Japan — trains only',
    };
  } else if (f.drivingAtDestination && f.idp1949Valid) {
    out.choices['n-drive'] = {
      choiceId: 'yes',
      ruleId:   'jp.preflight.drive.idp1949',
      reason:   'Driving in Japan; you have a valid 1949-convention IDP',
    };
  }

  return out;
};
```

- [ ] **Step 7: Update conditions/actions.ts return type**

In `src/lib/conditions/actions.ts`, the `resolveFlow` and `resolveFlowAction` return types now implicitly match the new `ResolverOutput` (the imported type already changed). Verify the imports at the top of the file include `ResolverOutput` from `@/lib/rules/types` and that the function return-type annotations still read `{ output: ResolverOutput; missing: ...; leg: Leg }`. No code change needed — TypeScript inference handles the structural difference. If TS still flags an error, add `import type { ResolverOutput } from '@/lib/rules/types';` explicitly.

- [ ] **Step 8: Update applyResolution argument type in use-trip-store.ts**

In `src/lib/use-trip-store.ts`, change the `Actions.applyResolution` signature and implementation. Replace lines 35 and 109–138 with:

```ts
// In the Actions type:
  applyResolution: (flowId: string, output: { choices: Record<string, { choiceId: string; ruleId: string; reason: string }>; info: Record<string, { title: string; desc: string; meta?: string; state: 'pass' | 'warn' | 'fail'; ruleId: string; reason: string }> }) => void;

// In the create() body:
  applyResolution: (flowId, output) =>
    set((s) => {
      const flow = TRIP.flows[flowId];
      if (!flow) return s;
      const previousResolved = s.flowResolved[flowId] ?? {};
      const overrides = s.flowOverrides[flowId] ?? {};
      const flowSpecificChoices = { ...(s.flowChoices[flowId] ?? {}) };

      // Restore previously-auto-resolved nodes that the new output drops
      // (and aren't user-overridden) back to their trip-data defaults.
      for (const nodeId of Object.keys(previousResolved)) {
        if (nodeId in output.choices) continue;
        if (nodeId in overrides) continue;
        const node = flow.nodes.find((n) => n.id === nodeId);
        if (node?.choices) {
          const def = node.choices.find((c) => c.on) ?? node.choices[0];
          flowSpecificChoices[nodeId] = def.id;
        }
      }

      for (const [nodeId, resolved] of Object.entries(output.choices)) {
        flowSpecificChoices[nodeId] = overrides[nodeId] ?? resolved.choiceId;
      }

      return {
        flowChoices: { ...s.flowChoices, [flowId]: flowSpecificChoices },
        flowResolved: { ...s.flowResolved, [flowId]: output.choices },
      };
    }),
```

This task only adjusts the existing logic to read from `output.choices`. Task 4 adds the `flowInfo` map writes.

- [ ] **Step 9: Update flow-modal.tsx to pass the full output object**

In `src/components/destify/flow-modal.tsx`, the FlowGraphView's resolveFlowAction call (line ~241):

```ts
const { output } = await resolveFlowAction(flow.id);
if (cancelled) return;
applyResolution(flow.id, output);
```

No textual change to this block — `applyResolution` now accepts the `{ choices, info }` shape directly because we updated its signature in Step 8. Verify the file still type-checks.

- [ ] **Step 10: Run all tests to verify they pass**

Run: `npm test`
Expected: PASS. All existing tests should now pass with the new shape; new info-related tests are introduced in Tasks 3+.

- [ ] **Step 11: Run TypeScript check and build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run build`
Expected: success.

- [ ] **Step 12: Commit**

```bash
git add src/lib/rules/ src/lib/conditions/actions.ts src/lib/use-trip-store.ts \
        src/components/destify/flow-modal.tsx \
        tests/leg-resolution.test.ts tests/profile-resolution.test.ts tests/store-resolution.test.ts
git commit -m "Split ResolverOutput into { choices, info } and reshape Facts

Decisions go in output.choices; the new info slot is empty until Task 3
adds the n-pass resolver branch. Facts gains residence and leg fields
for upcoming info-card logic.

Issue #14."
```

---

## Task 3: n-pass resolver branch (info card)

**Files:**
- Create: `tests/preflight-resolver.test.ts`
- Modify: `src/lib/rules/jp/preflight.ts`

- [ ] **Step 1: Write the failing unit test file**

Create `tests/preflight-resolver.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { resolvePreflightJP } from '@/lib/rules/jp/preflight';
import type { Facts, Leg } from '@/lib/rules/types';

const baseLeg: Leg = { from: 'US', to: 'JP', startDate: '2026-06-01', endDate: '2026-06-02' };

function makeFacts(overrides: Partial<Facts>): Facts {
  return {
    citizenships: [{ country: 'US', passportExpiry: '2029-08-15' }],
    residence: { country: 'US', visaStatus: null },
    controlledMeds: [],
    hasMinors: false,
    idp1949Valid: false,
    idp1968Valid: false,
    travelingWithMinors: false,
    drivingAtDestination: false,
    carryingControlledMeds: false,
    fromCountry: baseLeg.from,
    toCountry: baseLeg.to,
    stayDays: 1,
    leg: baseLeg,
    tables: {},
    ...overrides,
  };
}

describe('resolvePreflightJP n-pass info card', () => {
  it('passes for a US passport valid well past return + 6mo', () => {
    const out = resolvePreflightJP(makeFacts({}));
    const pass = out.info['n-pass'];
    expect(pass).toBeDefined();
    expect(pass.state).toBe('pass');
    expect(pass.title).toMatch(/^US Passport · valid /);
    expect(pass.ruleId).toBe('jp.preflight.pass.valid');
  });

  it('fails when passport expires before return + 6mo', () => {
    const out = resolvePreflightJP(makeFacts({
      citizenships: [{ country: 'US', passportExpiry: '2026-08-01' }],
      leg: { ...baseLeg, endDate: '2026-06-02' },
    }));
    const pass = out.info['n-pass'];
    expect(pass).toBeDefined();
    expect(pass.state).toBe('fail');
    expect(pass.ruleId).toBe('jp.preflight.pass.expires-too-soon');
    expect(pass.title).toMatch(/^US Passport · expires /);
  });

  it('warns when passport has no expiry recorded', () => {
    const out = resolvePreflightJP(makeFacts({
      citizenships: [{ country: 'US', passportExpiry: null }],
    }));
    const pass = out.info['n-pass'];
    expect(pass).toBeDefined();
    expect(pass.state).toBe('warn');
    expect(pass.ruleId).toBe('jp.preflight.pass.no-expiry');
    expect(pass.title).toBe('US Passport · expiry unknown');
  });

  it('warns when profile has no citizenships', () => {
    const out = resolvePreflightJP(makeFacts({ citizenships: [] }));
    const pass = out.info['n-pass'];
    expect(pass).toBeDefined();
    expect(pass.state).toBe('warn');
    expect(pass.ruleId).toBe('jp.preflight.pass.missing');
    expect(pass.title).toBe('No passport on file');
  });

  it('emits "MY Passport · ..." when primary citizenship is MY', () => {
    const out = resolvePreflightJP(makeFacts({
      citizenships: [{ country: 'MY', passportExpiry: '2030-01-15' }],
    }));
    expect(out.info['n-pass'].title).toMatch(/^MY Passport · valid /);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- preflight-resolver`
Expected: FAIL with `out.info['n-pass']` being undefined (no resolver branch yet).

- [ ] **Step 3: Add the n-pass branch to preflight.ts**

In `src/lib/rules/jp/preflight.ts`, at the top of the file (above `export const resolvePreflightJP`), add the helper functions:

```ts
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function addMonthsISO(iso: string, months: number): string {
  const [yStr, mStr, dStr] = iso.split('-');
  const y = +yStr, m = +mStr, d = +dStr;
  const targetMidx0 = m - 1 + months;
  const targetY = y + Math.floor(targetMidx0 / 12);
  const targetM = ((targetMidx0 % 12) + 12) % 12 + 1;
  return `${targetY}-${String(targetM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function formatMonthYear(iso: string): string {
  const [y, m] = iso.split('-');
  return `${MONTH_NAMES[+m - 1]} ${y}`;
}
```

Then inside `resolvePreflightJP`, after the closing brace of the `n-drive` block and before `return out;`, add:

```ts
  // n-pass — passport validity check against trip return + 6 months
  const primary = f.citizenships[0];
  const sixMonthsAfterReturn = addMonthsISO(f.leg.endDate, 6);

  if (!primary) {
    out.info['n-pass'] = {
      title: 'No passport on file',
      desc:  'Add a citizenship to your profile to enable identity checks.',
      meta:  'Profile incomplete',
      state: 'warn',
      ruleId: 'jp.preflight.pass.missing',
      reason: 'No citizenships in profile',
    };
  } else if (!primary.passportExpiry) {
    out.info['n-pass'] = {
      title: `${primary.country} Passport · expiry unknown`,
      desc:  `Confirm your passport is valid 6+ months past return (${formatMonthYear(sixMonthsAfterReturn)}).`,
      meta:  'Add expiry in profile to auto-check',
      state: 'warn',
      ruleId: 'jp.preflight.pass.no-expiry',
      reason: `${primary.country} citizenship has no expiry recorded`,
    };
  } else if (primary.passportExpiry >= sixMonthsAfterReturn) {
    out.info['n-pass'] = {
      title: `${primary.country} Passport · valid ${formatMonthYear(primary.passportExpiry)}`,
      desc:  `Japan requires 6 months past return — you have headroom past ${formatMonthYear(sixMonthsAfterReturn)}. ✓ passed.`,
      meta:  'Auto-checked from profile',
      state: 'pass',
      ruleId: 'jp.preflight.pass.valid',
      reason: `${primary.country} passport expires ${primary.passportExpiry}, ≥ 6mo after return`,
    };
  } else {
    out.info['n-pass'] = {
      title: `${primary.country} Passport · expires ${formatMonthYear(primary.passportExpiry)}`,
      desc:  `Japan requires validity 6+ months past return (${formatMonthYear(sixMonthsAfterReturn)}). Renew before flying.`,
      meta:  'Auto-check failed',
      state: 'fail',
      ruleId: 'jp.preflight.pass.expires-too-soon',
      reason: `${primary.country} passport expires ${primary.passportExpiry}, < 6mo after return`,
    };
  }
```

ISO date strings sort lexicographically — `'2029-08-15' >= '2026-12-02'` is correct for any well-formed YYYY-MM-DD.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- preflight-resolver`
Expected: PASS (all 5 cases green).

- [ ] **Step 5: Run full suite to confirm no regressions**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/rules/jp/preflight.ts tests/preflight-resolver.test.ts
git commit -m "Add n-pass resolver branch emitting ResolvedInfo (pass/warn/fail)

Four cases covered: valid passport, expires too soon, no expiry on file,
no citizenships at all. Uses native Date math; lex compare on ISO strings
for the 6-month-past-return check.

Issue #14."
```

---

## Task 4: Store flowInfo map + applyResolution writes both

**Files:**
- Modify: `src/lib/use-trip-store.ts`
- Modify: `tests/store-resolution.test.ts`

- [ ] **Step 1: Write failing tests for flowInfo round-trip and stale-clear**

In `tests/store-resolution.test.ts`, append the following describe block at the end (before the final close-brace of the file):

```ts
describe('applyResolution — flowInfo round-trip', () => {
  beforeEach(freshStore);

  it('writes the new info entry into flowInfo', () => {
    const { applyResolution } = useTripStore.getState();
    applyResolution('preflight-jp', {
      choices: {},
      info: {
        'n-pass': {
          title: 'US Passport · valid Aug 2029',
          desc:  'Japan requires 6 months past return…',
          meta:  'Auto-checked from profile',
          state: 'pass',
          ruleId: 'jp.preflight.pass.valid',
          reason: 'US passport expires 2029-08-15, ≥ 6mo after return',
        },
      },
    });
    expect(useTripStore.getState().flowInfo['preflight-jp']?.['n-pass']).toEqual({
      title: 'US Passport · valid Aug 2029',
      desc:  'Japan requires 6 months past return…',
      meta:  'Auto-checked from profile',
      state: 'pass',
      ruleId: 'jp.preflight.pass.valid',
      reason: 'US passport expires 2029-08-15, ≥ 6mo after return',
    });
  });

  it('replaces flowInfo wholesale when output.info changes', () => {
    const { applyResolution } = useTripStore.getState();
    applyResolution('preflight-jp', {
      choices: {},
      info: {
        'n-pass': {
          title: 'US Passport · valid Aug 2029',
          desc: 'old', meta: '', state: 'pass',
          ruleId: 'jp.preflight.pass.valid', reason: '',
        },
      },
    });
    applyResolution('preflight-jp', {
      choices: {},
      info: {
        'n-pass': {
          title: 'MY Passport · valid Jan 2030',
          desc: 'new', meta: '', state: 'pass',
          ruleId: 'jp.preflight.pass.valid', reason: '',
        },
      },
    });
    expect(useTripStore.getState().flowInfo['preflight-jp']['n-pass'].title)
      .toBe('MY Passport · valid Jan 2030');
  });

  it('clears stale info entries when re-resolve omits them', () => {
    const { applyResolution } = useTripStore.getState();
    applyResolution('preflight-jp', {
      choices: {},
      info: {
        'n-pass': {
          title: 'US Passport · valid Aug 2029',
          desc: '', meta: '', state: 'pass',
          ruleId: 'jp.preflight.pass.valid', reason: '',
        },
      },
    });
    applyResolution('preflight-jp', { choices: {}, info: {} });
    expect(useTripStore.getState().flowInfo['preflight-jp']).toEqual({});
  });
});
```

Also extend the `freshStore` helper at the top of the file: after `flowResolved: {}` add `flowInfo: {},` so the store starts clean for these tests:

```ts
  useTripStore.setState({
    flowChoices: initialChoices,
    flowResolved: {},
    flowOverrides: {},
    flowInfo: {},
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- store-resolution`
Expected: FAIL (`flowInfo` property does not exist on store state).

- [ ] **Step 3: Add flowInfo to store state and update applyResolution**

In `src/lib/use-trip-store.ts`, augment the `State` type. Replace the existing `flowOverrides` line (line 21) and the closing brace of `State` with:

```ts
  flowOverrides: Record<string, Record<string, string>>;
  flowInfo: Record<string, Record<string, { title: string; desc: string; meta?: string; state: 'pass' | 'warn' | 'fail'; ruleId: string; reason: string }>>;
};
```

Add the initializer in the `create()` body (after `flowOverrides: {},`):

```ts
  flowInfo: {},
```

Replace the entire `applyResolution` action body (in Task 2 you set this to read `output.choices`; now extend it to also write `flowInfo`) with:

```ts
  applyResolution: (flowId, output) =>
    set((s) => {
      const flow = TRIP.flows[flowId];
      if (!flow) return s;
      const previousResolved = s.flowResolved[flowId] ?? {};
      const overrides = s.flowOverrides[flowId] ?? {};
      const flowSpecificChoices = { ...(s.flowChoices[flowId] ?? {}) };

      // Restore previously-auto-resolved nodes that the new output drops
      // (and aren't user-overridden) back to their trip-data defaults.
      for (const nodeId of Object.keys(previousResolved)) {
        if (nodeId in output.choices) continue;
        if (nodeId in overrides) continue;
        const node = flow.nodes.find((n) => n.id === nodeId);
        if (node?.choices) {
          const def = node.choices.find((c) => c.on) ?? node.choices[0];
          flowSpecificChoices[nodeId] = def.id;
        }
      }

      for (const [nodeId, resolved] of Object.entries(output.choices)) {
        flowSpecificChoices[nodeId] = overrides[nodeId] ?? resolved.choiceId;
      }

      return {
        flowChoices: { ...s.flowChoices, [flowId]: flowSpecificChoices },
        flowResolved: { ...s.flowResolved, [flowId]: output.choices },
        flowInfo: { ...s.flowInfo, [flowId]: output.info },
      };
    }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- store-resolution`
Expected: PASS (all 8 tests across both describe blocks pass).

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/use-trip-store.ts tests/store-resolution.test.ts
git commit -m "Add flowInfo store map; applyResolution writes both choices and info

flowInfo follows the same stale-clear discipline as flowResolved (#8):
re-resolve replaces the whole flow's entries, so entries the new output
omits drop out and the UI falls back to static trip-data content.

Issue #14."
```

---

## Task 5: Flow modal wiring + RectNode reads flowInfo + trip-data fallback

**Files:**
- Modify: `src/components/destify/flow-modal.tsx`
- Modify: `src/lib/trip-data.ts`

No new tests — this task is shallow UI wiring covered by Tasks 3 and 4 unit tests and verified in the closing browser walkthrough (Task 9).

- [ ] **Step 1: Neutralize the hardcoded n-pass copy in trip-data.ts**

In `src/lib/trip-data.ts`, find the line at the top of the preflight-jp `nodes` array that defines `n-pass` (around line 236) and replace it with:

```ts
        { id: "n-pass", kind: "info", x: 1130, y: 220, label: "Identity", title: "Identity · pending", desc: "Auto-checks once your profile loads.", meta: "", done: false, next: "n-visa" },
```

Rationale: this is the fallback shown only when the resolver hasn't yet emitted (e.g., during the initial render before resolveFlowAction completes). The real content comes from `flowInfo['preflight-jp']['n-pass']`.

- [ ] **Step 2: Update RectNode to read from flowInfo**

In `src/components/destify/flow-modal.tsx`, update the `RectNode` component to read dynamic info content. Find the destructure at line 481 and the rendering blocks at lines 523–547 and replace the entire `RectNode` function (lines 480–566) with:

```tsx
function RectNode({ data }: NodeProps<Node<NodeData>>) {
  const { toggleFlowDone, flowInfo } = useTripStore();
  const size = NODE_SIZE[data.kind];

  const info = data.kind === "info" ? flowInfo[data.flowId]?.[data.id] : undefined;
  const title = info?.title ?? data.title;
  const desc = info?.desc ?? data.desc;
  const meta = info?.meta ?? data.meta;
  const state = info?.state;

  const bg =
    data.kind === "action"
      ? "linear-gradient(180deg, #FBEDDF, var(--cream))"
      : data.kind === "info"
        ? "var(--sand)"
        : "var(--cream)";
  const border =
    data.kind === "action" ? "rgba(192,120,86,.45)" : "rgba(148,139,130,.35)";

  return (
    <div
      className="relative rounded-md border-[1.5px] px-3.5 py-3 shadow-sm transition-shadow hover:shadow-md"
      style={{
        width: size.width,
        height: size.height,
        background: bg,
        borderColor: data.isDone ? "rgba(139,157,131,.55)" : border,
        opacity: data.isOnPath ? 1 : 0.32,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />

      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFlowDone(data.flowId, data.id);
        }}
        className="absolute -left-2.5 -top-2.5 grid h-6 w-6 place-items-center rounded-full border-[1.5px] transition-colors"
        style={{
          background: data.isDone ? "var(--sage-deep)" : "var(--cream)",
          color: data.isDone ? "var(--cream)" : "transparent",
          borderColor: data.isDone ? "var(--sage-deep)" : "var(--mocha-soft)",
        }}
        aria-label="Toggle done"
      >
        <Check className="h-3.5 w-3.5" />
      </button>

      <div
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em]"
        style={{ color: "var(--mocha)" }}
      >
        {(state === "warn" || state === "fail") && (
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "#C07856" }}
          />
        )}
        {data.label}
      </div>
      <div className="mt-1 text-[13.5px] font-semibold leading-snug tracking-tight">
        {title}
      </div>
      {desc && (
        <div
          className="mt-1.5 line-clamp-3 text-[11.5px] leading-snug"
          style={{ color: "var(--charcoal-soft)" }}
        >
          {desc}
        </div>
      )}
      {meta && (
        <div
          className="mt-1.5 font-mono text-[10.5px]"
          style={{ color: "var(--mocha)" }}
        >
          {meta}
        </div>
      )}
      {data.link && (
        <a
          href={data.link.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2.5 left-3.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]"
          style={{
            background: "var(--cream)",
            borderColor: "rgba(45,90,123,.25)",
            color: "var(--ocean)",
          }}
        >
          {data.link.label} <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
```

The amber dot is the only state-driven visual for now — fail uses the same dot as warn. Distinct fail treatment lands in #18.

- [ ] **Step 3: Run full suite (UI logic compile check)**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Run build to verify type-correctness end-to-end**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/components/destify/flow-modal.tsx src/lib/trip-data.ts
git commit -m "RectNode reads flowInfo; trip-data n-pass becomes neutral fallback

Auto-resolved info cards now derive title/desc/meta/state from the
resolver via flowInfo. The hardcoded 'US Passport · valid Aug 2029'
copy is replaced with 'Identity · pending' shown only when the
resolver hasn't run. Warn/fail render a small amber dot before the
label; distinct fail polish is #18.

Issue #14."
```

---

## Task 6: Onboarding wizard — passport expiry + residence visa-status UI

**Files:**
- Modify: `src/app/onboarding/wizard.tsx`

- [ ] **Step 1: Replace the wizard's local Tier1 type with the new shape**

In `src/app/onboarding/wizard.tsx`, replace the `Tier1` type definition and `EMPTY` constant (lines 9–24) with:

```ts
type Tier1 = {
  citizenships: { country: string; passportExpiry: string | null }[];
  residence: { country: string; visaStatus: 'tourist' | 'permanent' | 'digital-nomad' | 'work' | 'other' | null } | null;
  idpConvention: '1949' | '1968' | null;
  idpExpiry: string | null;
  controlledMeds: string[];
  hasMinors: boolean;
  drivesAbroad: boolean; // wizard-local toggle; not persisted
};

const EMPTY: Tier1 = {
  citizenships: [],
  residence: null,
  idpConvention: null, idpExpiry: null,
  controlledMeds: [], hasMinors: false,
  drivesAbroad: true,
};
```

- [ ] **Step 2: Simplify the save function (no more coercion needed)**

Replace the `save` function (still ~lines 32–48 after Task 1's change) with:

```ts
  const save = (next: Tier1, after: () => void) => {
    startTransition(async () => {
      try {
        await saveProfileAction({
          citizenships: next.citizenships,
          residence: next.residence,
          idpConvention: next.drivesAbroad ? next.idpConvention : null,
          idpExpiry: next.drivesAbroad ? next.idpExpiry : null,
          controlledMeds: next.controlledMeds,
          hasMinors: next.hasMinors,
        });
        after();
      } catch {
        toast("Couldn't save — please retry");
      }
    });
  };
```

- [ ] **Step 3: Replace the Identity step with the new per-citizenship-expiry + residence-status UI**

Replace the entire `Identity` component (lines 84–100) with:

```tsx
function Identity({ data, setData }: { data: Tier1; setData: (d: Tier1) => void }) {
  const setCitizenshipExpiry = (country: string, expiry: string | null) => {
    setData({
      ...data,
      citizenships: data.citizenships.map((c) =>
        c.country === country ? { ...c, passportExpiry: expiry } : c,
      ),
    });
  };

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 4 }}>About you</h2>
      <p style={{ color: 'var(--mocha)', marginBottom: 20, fontSize: 14 }}>Used to personalize visa, driving, and health rules.</p>

      <Label>Citizenships</Label>
      <MultiCountry
        value={data.citizenships.map((c) => c.country)}
        onChange={(codes) => {
          const next = codes.map((code) =>
            data.citizenships.find((c) => c.country === code) ?? { country: code, passportExpiry: null },
          );
          setData({ ...data, citizenships: next });
        }}
      />

      {data.citizenships.map((c) => (
        <div key={c.country} style={{ marginTop: 10 }}>
          <Label>{c.country} passport expiry (optional)</Label>
          <input
            type="date"
            value={c.passportExpiry ?? ''}
            onChange={(e) => setCitizenshipExpiry(c.country, e.target.value || null)}
            style={inputStyle}
          />
        </div>
      ))}

      <Label style={{ marginTop: 16 }}>Country of residence</Label>
      <SingleCountry
        value={data.residence?.country ?? null}
        onChange={(v) => setData({
          ...data,
          residence: v ? { country: v, visaStatus: data.residence?.visaStatus ?? null } : null,
        })}
      />

      {data.residence && (
        <>
          <Label style={{ marginTop: 12 }}>Visa status in this country (optional)</Label>
          <select
            value={data.residence.visaStatus ?? ''}
            onChange={(e) => {
              const v = (e.target.value || null) as 'tourist' | 'permanent' | 'digital-nomad' | 'work' | 'other' | null;
              setData({ ...data, residence: { ...data.residence!, visaStatus: v } });
            }}
            style={inputStyle}
          >
            <option value="">— none —</option>
            <option value="tourist">Tourist</option>
            <option value="permanent">Permanent resident</option>
            <option value="digital-nomad">Digital-nomad visa</option>
            <option value="work">Work visa</option>
            <option value="other">Other</option>
          </select>
        </>
      )}

      <Label style={{ marginTop: 16 }}>Traveling with minors?</Label>
      <YesNo value={data.hasMinors} onChange={(v) => setData({ ...data, hasMinors: v })} />
    </div>
  );
}
```

- [ ] **Step 4: Smoke-test the wizard in the browser**

Run: `npm run dev`
Open `http://localhost:3000/onboarding`. Click through:
1. Add citizenship "US" → expiry input appears → enter `2029-08-15`.
2. Set residence to "US" → visa-status select appears → choose "Tourist."
3. Click Continue through Driving + Health steps → Finish.
4. Navigate to `/profile` → confirm the data round-tripped (after Task 7 form changes, the new fields will be editable; until then the form still shows the bare basics from Task 1's coercion).

Verify no console errors. Stop the dev server.

- [ ] **Step 5: Run tests + build**

Run: `npm test && npm run build`
Expected: PASS, success.

- [ ] **Step 6: Commit**

```bash
git add src/app/onboarding/wizard.tsx
git commit -m "Wizard captures passport expiry per citizenship + residence visa status

Step 1 (About you) now renders a date input under each selected
citizenship and a visa-status select under the residence country.

Issue #14."
```

---

## Task 7: Profile form — passport expiry + residence visa-status UI

**Files:**
- Modify: `src/app/profile/form.tsx`

- [ ] **Step 1: Switch the form's state to the new citizenship + residence shapes**

In `src/app/profile/form.tsx`, replace the state declarations (lines 20–27 after Task 1's coercion) and the `save` function (lines 29–40) with:

```ts
  const [citizenships, setCitizenships] = useState<{ country: string; passportExpiry: string | null }[]>(
    initial?.citizenships ?? [],
  );
  const [residence, setResidence] = useState<{ country: string; visaStatus: 'tourist' | 'permanent' | 'digital-nomad' | 'work' | 'other' | null } | null>(
    initial?.residence ?? null,
  );
  const [conv, setConv] = useState<'1949' | '1968' | null>(initial?.idpConvention ?? null);
  const [expiry, setExpiry] = useState<string | null>(initial?.idpExpiry ?? null);
  const [meds, setMeds] = useState<string[]>(initial?.controlledMeds ?? []);
  const [hasMinors, setHasMinors] = useState<boolean>(initial?.hasMinors ?? false);
  const [medDraft, setMedDraft] = useState('');
  const [pending, startTransition] = useTransition();

  const save = () => startTransition(async () => {
    try {
      await saveProfileAction({
        citizenships, residence,
        idpConvention: conv, idpExpiry: expiry,
        controlledMeds: meds, hasMinors,
      });
      toast('Profile saved');
    } catch {
      toast("Couldn't save — please retry");
    }
  });
```

- [ ] **Step 2: Replace the Identity section JSX with the new fields**

In the `return (...)` block, find the `<Section title="Identity">` block and replace it (currently lines 50–57 after Task 1's coercion) with:

```tsx
        <Section title="Identity">
          <Label>Citizenships</Label>
          <MultiCountry
            value={citizenships.map((c) => c.country)}
            onChange={(codes) => {
              const next = codes.map((code) =>
                citizenships.find((c) => c.country === code) ?? { country: code, passportExpiry: null },
              );
              setCitizenships(next);
            }}
          />

          {citizenships.map((c) => (
            <div key={c.country} style={{ marginTop: 10 }}>
              <Label>{c.country} passport expiry (optional)</Label>
              <input
                type="date"
                value={c.passportExpiry ?? ''}
                onChange={(e) => setCitizenships(citizenships.map((x) =>
                  x.country === c.country ? { ...x, passportExpiry: e.target.value || null } : x,
                ))}
                style={inputStyle}
              />
            </div>
          ))}

          <Label style={{ marginTop: 16 }}>Country of residence</Label>
          <SingleCountry
            value={residence?.country ?? null}
            onChange={(v) => setResidence(v ? { country: v, visaStatus: residence?.visaStatus ?? null } : null)}
          />

          {residence && (
            <>
              <Label style={{ marginTop: 12 }}>Visa status in this country (optional)</Label>
              <select
                value={residence.visaStatus ?? ''}
                onChange={(e) => setResidence({ ...residence, visaStatus: (e.target.value || null) as 'tourist' | 'permanent' | 'digital-nomad' | 'work' | 'other' | null })}
                style={inputStyle}
              >
                <option value="">— none —</option>
                <option value="tourist">Tourist</option>
                <option value="permanent">Permanent resident</option>
                <option value="digital-nomad">Digital-nomad visa</option>
                <option value="work">Work visa</option>
                <option value="other">Other</option>
              </select>
            </>
          )}

          <Label style={{ marginTop: 16 }}>Has minors</Label>
          <YesNo value={hasMinors} onChange={setHasMinors} />
        </Section>
```

- [ ] **Step 3: Smoke-test the profile form**

Run: `npm run dev`
Open `http://localhost:3000/profile`. Verify:
1. Existing citizenships render with expiry inputs.
2. Setting an expiry and clicking "Save profile" persists (re-load page, value is still there).
3. Setting residence + visa-status persists.
4. Switching to a different citizenship list preserves expiries for retained countries.

Stop the dev server.

- [ ] **Step 4: Run tests + build**

Run: `npm test && npm run build`
Expected: PASS, success.

- [ ] **Step 5: Commit**

```bash
git add src/app/profile/form.tsx
git commit -m "Profile form: per-citizenship passport expiry + residence visa status

Mirrors the wizard's new fields so users can edit them after onboarding.

Issue #14."
```

---

## Task 8: Acceptance test — n-pass info round-trip via Server Action layer

**Files:**
- Modify: `tests/profile-resolution.test.ts`

- [ ] **Step 1: Write the failing acceptance test extension**

In `tests/profile-resolution.test.ts`, append the following `it` block inside the existing `describe('profile-driven resolution', ...)`:

```ts
  it('emits n-pass info with the primary citizenship and pass state', async () => {
    const db = await makeDb();
    const { userId } = await signInDemo(db);
    await saveProfile(db, userId, {
      citizenships: [{ country: 'US', passportExpiry: '2029-08-15' }],
      residence: { country: 'US', visaStatus: null },
      idpConvention: null, idpExpiry: null,
      controlledMeds: [], hasMinors: false,
    });

    const { output } = await resolveFlow(db, 'preflight-jp');
    expect(output.info['n-pass']).toBeDefined();
    expect(output.info['n-pass'].state).toBe('pass');
    expect(output.info['n-pass'].title).toMatch(/^US Passport · valid /);
  });

  it('emits a no-expiry warn when primary citizenship lacks passportExpiry (KE)', async () => {
    const db = await makeDb();
    const { userId } = await signInDemo(db);
    await saveProfile(db, userId, {
      citizenships: [{ country: 'KE', passportExpiry: null }],
      residence: { country: 'KE', visaStatus: null },
      idpConvention: null, idpExpiry: null,
      controlledMeds: [], hasMinors: false,
    });

    const { output } = await resolveFlow(db, 'preflight-jp');
    expect(output.info['n-pass']).toBeDefined();
    expect(output.info['n-pass'].state).toBe('warn');
    expect(output.info['n-pass'].ruleId).toBe('jp.preflight.pass.no-expiry');
    expect(output.info['n-pass'].title).toBe('KE Passport · expiry unknown');
  });

  it('emits a missing-citizenship warn when profile has zero citizenships', async () => {
    const db = await makeDb();
    const { userId } = await signInDemo(db);
    await saveProfile(db, userId, {
      citizenships: [],
      residence: null,
      idpConvention: null, idpExpiry: null,
      controlledMeds: [], hasMinors: false,
    });

    const { output } = await resolveFlow(db, 'preflight-jp');
    expect(output.info['n-pass']).toBeDefined();
    expect(output.info['n-pass'].state).toBe('warn');
    expect(output.info['n-pass'].ruleId).toBe('jp.preflight.pass.missing');
  });
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- profile-resolution`
Expected: PASS (Task 3 already implemented the resolver; this just exercises the end-to-end path through Server Action layer).

- [ ] **Step 3: Run full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/profile-resolution.test.ts
git commit -m "Acceptance test: n-pass info round-trips through Server Action layer

Confirms three branches (US pass, KE no-expiry warn, no-citizenship warn)
work end-to-end through saveProfile → resolveFlow with a real pglite DB
and session cookie.

Issue #14."
```

---

## Task 9: Final verification + browser walkthrough

**Files:** None. This task verifies the integrated system.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS (all describe blocks across all test files).

- [ ] **Step 2: TypeScript clean**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors introduced by this PR. The two pre-existing lint errors in the repo (separate from this work) are acceptable.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: success, no type errors, no Server Component / Server Action complaints.

- [ ] **Step 5: Browser walkthrough**

Run: `npm run dev` and walk through each of these in the browser:

1. **Default demo user → preflight modal shows `n-pass` "pass"**
   - Open `/` and sign in as demo.
   - Land on `/organizer`. Open the preflight checkpoint modal.
   - n-pass renders: title "US Passport · valid Aug 2029" (or similar — month/year derived from the seeded user's profile if you've saved one; if no profile saved, fall back to "No passport on file" warn).
   - Verify no amber dot on the label (state is pass).

2. **Citizenship swap updates the card**
   - Navigate to `/profile`. Remove US, add MY. Save.
   - Return to `/organizer`. Reopen the preflight modal.
   - n-pass title now reads "MY Passport · ..." (or the no-expiry/missing variant if expiry isn't set for MY).

3. **Empty citizenships → warn card**
   - Back to `/profile`. Remove all citizenships. Save.
   - Reopen preflight modal.
   - n-pass shows title "No passport on file", desc mentions adding a citizenship, amber dot visible on label.

4. **Expiry-too-soon → fail (folded into warn dot)**
   - In `/profile`, add citizenship US with passport expiry `2026-04-01` (before the demo trip's return date + 6 months). Save.
   - Reopen preflight modal.
   - n-pass title reads "US Passport · expires Apr 2026" with the amber dot. Desc says "Renew before flying."

5. **n-bag unchanged**
   - Scroll to the bottom of the preflight flow. The `n-bag` info card (packing weight) still shows its trip-data text unchanged across all of the above.

6. **No console errors at any step.**

- [ ] **Step 6: Push and ship**

Once browser walkthrough is clean:

```bash
git push origin main
gh issue close 14 --comment "Shipped in $(git rev-parse --short HEAD). n-pass info card now profile-driven; #15-#18 capture follow-up work."
```

---

## Wrap-up

After Task 9 ships, this PR has:

- Reshaped `PermanentProfile` to keep "who you are and where you live" cleanly isolated from per-trip data.
- Extended the resolver pipeline so info-kind nodes can carry resolver-driven content alongside decisions.
- Plumbed the store, modal, and `RectNode` for the new content.
- Added test coverage at four levels (zod schema, store action, resolver unit, end-to-end Server Action).
- Filed #15–#18 for the natural follow-up work (layovers, multi-citizenship picker, visa-status consumers, fail-state polish).

The hardcoded "US Passport · valid Aug 2029" copy in `trip-data.ts` is replaced with a neutral pending state; real content always comes from the resolver.
