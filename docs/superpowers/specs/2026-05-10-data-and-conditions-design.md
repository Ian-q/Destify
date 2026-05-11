# Data Model & Conditions Sourcing Design

**Status:** approved spec, pending implementation plan
**Scope:** the data layer that feeds the existing rule layer ([2026-05-07-rule-layer-design.md](2026-05-07-rule-layer-design.md)) — the `PermanentProfile` and `TripContext` shapes the rule layer references, the `Trip`/`Leg` structure, Postgres persistence, and how country-condition rows get sourced (hand-curated seed + AI fallback). The rule layer spec itself is unchanged; this spec is the layer below it.

## Problem

The rule layer spec defines `FlowResolver` functions that consume `Facts` — but `Facts` is built from `(PermanentProfile, TripContext, Leg)`, and none of those exist yet. Worse, every resolver shown in that spec embeds rules inline (e.g., "US passport + ≤90 days → exempt"). That doesn't scale past the JP demo: with 200 countries × dozens of citizenships, every visa-exemption tuple cannot live in TypeScript.

We need three things:

1. **A typed, persistent data model** for users, trips, legs, profiles, and trip context — so the rule layer has real inputs and the prototype can show actual auto-resolution end-to-end.
2. **A condition-row store** so the bulk of cross-country rules (visa exemption, med imports, driving conventions, etc.) live as data, not code. Resolvers stay thin and look up rows; rules-as-data scales to long-tail countries.
3. **An AI fallback** that fills missing rows on demand, with citations and confidence levels, validated against the same Zod schemas the seed data uses. The user never sees "no data, ask elsewhere"; they see either an authoritative row, an AI-sourced row with provenance, or a "couldn't verify, please confirm" affordance.

The product framing matters: Destify is an organizer and (eventually) a planner — never a deal-finder or booking site. The data model serves both modes. Profile fields the future planner needs (cards held, points programs) live as extensible JSONB now and graduate to first-class columns only when a rule consumes them.

## Architecture

Four cooperating concerns under `src/lib/`:

```
src/lib/
├─ db/
│  ├─ schema.ts             // Drizzle table definitions
│  └─ client.ts             // Drizzle Postgres client
├─ profile-extras.ts        // Zod schemas for ProfileExtras / TripContextExtras
├─ conditions/
│  ├─ registry.ts           // ROW_TYPES — typed declaration of every row type
│  ├─ seed.ts               // Loads src/data/conditions/**/*.yaml at boot
│  ├─ ai.ts                 // Vercel AI Gateway fallback
│  ├─ index.ts              // getRow() — the public API: seed → cache → AI
│  ├─ readiness.ts          // hydrateLeg() — bulk row fetch per leg
│  └─ actions.ts            // 'use server' boundary — resolveFlowAction()
└─ rules/                   // (per existing rule layer spec, extended)
   ├─ types.ts              // Facts now has a `tables` field
   ├─ facts.ts              // buildFacts accepts optional hydrated tables
   └─ index.ts              // FlowEntry adds requiredRows()
```

```
src/data/conditions/        // seed rules; one YAML per (type, key)
├─ visa_exemption/
│  ├─ US:JP.yaml
│  ├─ US:KE.yaml
│  └─ ...
├─ med_import/
│  ├─ JP.yaml
│  └─ ...
└─ driving/
   ├─ JP.yaml
   └─ ...
```

The existing rule layer is unchanged: `FlowResolver` functions remain pure, sync, and consume `Facts`. The two extensions are (a) `Facts.tables` exposing hydrated condition rows, and (b) each flow registry entry now declares a `requiredRows(facts)` function so the data layer knows what to prefetch.

## Data model

Drizzle Postgres schemas. Names are final; columns may grow at write time.

```ts
// users — placeholder until auth lands (separate spec). Profile is keyed by user_id.
users: {
  id: uuid pk,
  email: citext unique,
  createdAt: timestamptz default now(),
}

// permanent_profile — 1:1 with user, durable facts
permanent_profile: {
  userId: uuid pk fk → users.id,
  citizenships: text[],            // ISO-3166 alpha-2
  homeCountry: text,               // ISO-3166 alpha-2, nullable
  idpConvention: enum('1949','1968') | null,
  idpExpiry: date | null,
  controlledMeds: text[],          // generic med names that require import permits
  hasMinors: boolean default false,
  extras: jsonb default '{}',      // ProfileExtras (Zod-validated in code)
  updatedAt: timestamptz default now(),
}

// trip — one user has many trips
trip: {
  id: uuid pk,
  userId: uuid fk → users.id,
  name: text,
  startDate: date,
  endDate: date,
  status: enum('planning','booked','active','past') default 'planning',
  createdAt: timestamptz default now(),
}

// leg — ordered segments of a trip
leg: {
  id: uuid pk,
  tripId: uuid fk → trip.id on delete cascade,
  seq: int,
  fromCountry: text,               // ISO-3166 alpha-2
  toCountry: text,
  startDate: date,
  endDate: date,
  unique(tripId, seq),
}

// trip_context — 1:1 with trip, trip-level facts that propagate to every leg
trip_context: {
  tripId: uuid pk fk → trip.id on delete cascade,
  travelingWithMinors: boolean default false,
  drivingAtDestination: boolean default false,    // true if any leg requires driving
  carryingControlledMeds: boolean default false,
  purpose: enum('tourism','business','family','study') | null,
  extras: jsonb default '{}',      // TripContextExtras (Zod-validated in code)
  updatedAt: timestamptz default now(),
}

// condition_row — the seed + cache store
condition_row: {
  rowType: text,                   // 'visa_exemption' | 'med_import' | 'driving' | ...
  rowKey: text,                    // canonical key per rowType
  data: jsonb,                     // validated by ROW_TYPES[rowType].schema
  source: enum('seed','ai'),
  confidence: enum('high','medium','low') | null,    // null for seed
  citations: jsonb | null,         // [{ url, snippet, fetchedAt }] for ai rows
  fetchedAt: timestamptz default now(),
  expiresAt: timestamptz | null,   // null = never expires (seed rows)
  primary key (rowType, rowKey),
}
```

**Tier-1 vs tier-2 fields.** Explicit columns are reserved for fields current resolvers consume, plus `homeCountry` because it is cheap, useful background, and likely to graduate to a resolver soon. Everything else (cards held, points balances, dietary, allergies, mobility, accommodation type, etc.) lives in `extras` JSONB, validated by Zod schemas in `src/lib/profile-extras.ts`:

```ts
export const ProfileExtras = z.object({
  cards:        z.array(z.object({ network: z.string(), tier: z.string(), benefits: z.array(z.string()).optional() })).optional(),
  pointsProgs:  z.array(z.object({ program: z.string(), tier: z.string().optional() })).optional(),
  dietary:      z.array(z.string()).optional(),
  allergies:    z.array(z.string()).optional(),
  mobility:     z.array(z.string()).optional(),
  // grow this schema freely; promotion to first-class column requires a migration
}).strict();
export type ProfileExtras = z.infer<typeof ProfileExtras>;
```

Reads use `.safeParse()` so an unknown field from an older app version doesn't crash; writes use `.parse()` to reject malformed input.

**Why `condition_row(rowType, rowKey)` is one table.** Polymorphic per-row tables would require a polymorphic join for `getRow`. A single `(text, text) → jsonb` table with type-keyed Zod validation in the application layer is simpler and indexable. Seed rows always win on conflict against AI rows via partial-unique upsert (`ON CONFLICT (rowType, rowKey) WHERE source='ai' DO UPDATE`).

## Conditions sourcing layer

Three modules under `src/lib/conditions/`.

### Registry — typed declaration of every row type

```ts
// src/lib/conditions/registry.ts
import { z } from 'zod';

export const ROW_TYPES = {
  visa_exemption: {
    schema: z.object({
      exemptDays: z.number().int().nullable(),    // null = visa required
      notes: z.string().optional(),
    }),
    keyFormat: 'citizenship:destination',         // 'US:JP'
    ttlDays: 180,
  },
  med_import: {
    schema: z.object({
      allowed: z.array(z.string()),
      permitRequired: z.array(z.string()),
      banned: z.array(z.string()),
      permitName: z.string().optional(),          // e.g. 'Yakkan Shoumei' for JP
    }),
    keyFormat: 'destination',                     // 'JP'
    ttlDays: 90,
  },
  driving: {
    schema: z.object({
      idpConvention: z.enum(['1949','1968']).nullable(),    // null = no IDP needed
      notes: z.string().optional(),
    }),
    keyFormat: 'destination',
    ttlDays: 365,
  },
} as const satisfies Record<string, RowTypeDef>;

export type RowOf<T extends keyof typeof ROW_TYPES> =
  z.infer<typeof ROW_TYPES[T]['schema']>;
```

Adding a new row type = one entry in `ROW_TYPES`. Nothing else needs to change.

### Seed loader

```ts
// src/lib/conditions/seed.ts
// At app boot (or on a CLI command), walks src/data/conditions/<type>/<key>.yaml,
// parses each file with ROW_TYPES[type].schema, upserts as source='seed' / expiresAt=null.
// Runs once per process startup; idempotent.
export async function loadSeedRows(): Promise<{ inserted: number; updated: number }>;
```

Seed files are checked into the repo. Editing a seed file requires a redeploy. That is intentional: tier-1 country rules are part of the product surface and reviewed like code.

### AI fallback

```ts
// src/lib/conditions/ai.ts
import { generateObject } from 'ai';
import { z } from 'zod';
import { ROW_TYPES } from './registry';

const Citation = z.object({ url: z.string().url(), snippet: z.string().optional(), fetchedAt: z.string() });

export async function fetchRowViaAI<T extends keyof typeof ROW_TYPES>(
  rowType: T, rowKey: string,
): Promise<{ data: RowOf<T>; confidence: 'high'|'medium'|'low'; citations: z.infer<typeof Citation>[] } | null> {
  // Calls Vercel AI Gateway via provider/model string (e.g. 'anthropic/claude-opus-4-7').
  // structured output target = ROW_TYPES[rowType].schema.extend({
  //   confidence: z.enum(['high','medium','low']),
  //   citations: z.array(Citation),
  // })
  // System prompt instructs: use authoritative sources; lower confidence if uncertain;
  // include at least one citation URL when possible.
  // Returns null on Gateway error, schema validation failure, or empty completion.
}
```

Citations are optional per the design decision; confidence is required. UI uses confidence to decide what badge to render. A "couldn't verify" affordance fires when AI returns `null` AND there is no stale cached row to fall back on.

### Public API

```ts
// src/lib/conditions/index.ts
export async function getRow<T extends keyof typeof ROW_TYPES>(
  type: T, key: string,
): Promise<RowOf<T> | null> {
  // 1. SELECT FROM condition_row WHERE rowType=type AND rowKey=key
  //    - if found && (expiresAt IS NULL || expiresAt > now()) → return data
  //    - if found && expired → keep as stale fallback, fall through
  // 2. fetchRowViaAI(type, key)
  //    - if returns { data, confidence, citations } → INSERT/UPDATE row with
  //      source='ai', expiresAt = now() + ROW_TYPES[type].ttlDays, return data
  //    - if returns null → fall through
  // 3. If we kept a stale row in step 1, return it (better stale than nothing).
  //    Otherwise return null.
}
```

**Failure semantics.** `getRow` returning `null` means "no positive evidence." Resolvers treat that identically to "user hasn't told us yet" — the node is left unresolved, the user is prompted. This is the absence-≠-negative principle from the rule layer spec, applied to the data layer.

## Per-leg readiness

Each flow declares which condition rows it consumes via a small addition to the rule layer registry:

```ts
// src/lib/rules/index.ts (extension)
type FlowEntry = {
  resolver: FlowResolver;
  requiredRows: (facts: Facts) => Array<{
    type: keyof typeof ROW_TYPES;
    key: string;
  }>;
};

const REGISTRY: Record<string, FlowEntry> = {
  'preflight-jp': {
    resolver: resolvePreflightJP,
    requiredRows: (f) => [
      ...f.citizenships.map(c => ({ type: 'visa_exemption' as const, key: `${c}:${f.toCountry}` })),
      { type: 'med_import' as const, key: f.toCountry },
      { type: 'driving' as const,    key: f.toCountry },
    ],
  },
};
```

```ts
// src/lib/conditions/readiness.ts
export type HydratedLeg = {
  facts: Facts;                                          // facts.tables populated below
  missing: Array<{ type: string; key: string }>;         // rows that returned null
};

export async function hydrateLeg(
  profile: PermanentProfile, context: TripContext, leg: Leg,
): Promise<HydratedLeg> {
  const facts = buildFacts(profile, context, leg);
  const flowIds = flowsForLeg(leg);
  const required = flowIds.flatMap(id => REGISTRY[id].requiredRows(facts));
  const rows = await Promise.all(
    required.map(r => getRow(r.type, r.key).then(data => ({ ...r, data }))),
  );
  facts.tables = groupRowsByType(rows.filter(r => r.data));
  const missing = rows.filter(r => !r.data).map(({ data: _, ...rest }) => rest);
  return { facts, missing };
}
```

**Trigger and the client/server boundary.** `FlowGraphView` is a client component. `hydrateLeg` reaches into Neon via the Drizzle client, which is a *server-only* concern — `DATABASE_URL` is intentionally never exposed to the browser by Next.js. The client therefore cannot call `hydrateLeg` directly; doing so crashes with `DATABASE_URL not set` on the first browser render.

The boundary is a Next.js Server Action. `src/lib/conditions/actions.ts` starts with `'use server'` and exports a single function the client may call:

```ts
// src/lib/conditions/actions.ts
'use server';

import { hydrateLeg } from './readiness';
import { resolveFlow } from '@/lib/rules/index';
import type { PermanentProfile, TripContext } from '@/lib/user-profile';
import type { Leg, ResolverOutput } from '@/lib/rules/types';

export async function resolveFlowAction(
  flowId: string, profile: PermanentProfile, context: TripContext, leg: Leg,
): Promise<{ output: ResolverOutput; missing: { type: string; key: string }[] }> {
  const { facts, missing } = await hydrateLeg(profile, context, leg, { flowId });
  const output = resolveFlow(flowId, profile, context, leg, { tables: facts.tables });
  return { output, missing };
}
```

The client effect calls the action and applies the result:

```ts
useEffect(() => {
  let cancelled = false;
  (async () => {
    const { output, missing } = await resolveFlowAction(flow.id, profile, context, leg);
    if (cancelled) return;
    applyResolution(flow.id, output);
    setMissing(missing);
  })();
  return () => { cancelled = true; };
}, [flow.id, profile, context, leg]);
```

`resolveFlow` and `buildFacts` stay synchronous. `hydrateLeg` stays unchanged. The await happens at the Server Action boundary; resolvers keep their sync, pure shape, and the DB client never appears in a client bundle.

**Profile/context inputs to the action.** Until auth and onboarding ship, the client passes hard-coded demo values; once auth lands, the action will derive `profile` and `context` server-side from the authenticated user instead of trusting the client. Treat the current shape as a temporary scaffold, not a long-term contract.

**Cascade across legs.** `TripContext` is per-trip, not per-leg, so `carryingControlledMeds: true` propagates to every leg's `Facts` automatically. A US→JP→PH trip runs `hydrateLeg` three times (once per leg); each leg pulls its own destination rows (`med_import:JP`, then `med_import:PH`) but reads the same `carryingControlledMeds` from `trip_context`. Visual treatment of "child nodes appear on later legs" is a downstream UI concern; the data already supports it.

**Leg-stable UX.** A leg is "ready" when `missing` is empty for its flows. UI renders a per-leg readiness indicator. Legs hydrate independently and can be requeried.

## Integration with the rule layer

The rule layer spec is **unchanged**. Three small surface additions:

1. **`Facts.tables`** — new typed sub-object exposing hydrated rows to resolvers:

   ```ts
   export type Facts = {
     // ...existing fields from rule layer spec...
     tables: {
       visa_exemption?: Record<string, RowOf<'visa_exemption'>>;
       med_import?:     Record<string, RowOf<'med_import'>>;
       driving?:        Record<string, RowOf<'driving'>>;
     };
   };
   ```

2. **`buildFacts` signature widens** to accept an optional hydrated tables map. When omitted (e.g., unit tests of the rule layer in isolation), `facts.tables` is `{}` and resolvers behave per absence-≠-negative.

3. **JP preflight resolver becomes table-driven** for the visa rule. The IDP-1949 rule and the meds rule stay as TS logic (they need real branching), but visa exemption — a lookup — becomes:

   ```ts
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
   ```

This is the data-driven half of the split mentioned in the architecture: TS for branching logic, table rows for tabular truth. The JP preflight resolver after this change is ~30 lines and works for every citizenship without a code change.

## Error handling

All failure modes degrade gracefully and never block the user from progressing manually.

- **Postgres unreachable / `hydrateLeg` rejects** → `FlowGraphView` catches; modal renders with hand-defaulted choices and a banner: *"Couldn't load conditions, please retry."* `applyResolution` is not called, so no incorrect provenance appears.
- **AI Gateway timeout / error in `fetchRowViaAI`** → returns `null`; `getRow` falls back to stale cached row if any, else `null`; resolver sees no positive evidence, leaves node unresolved.
- **AI returns malformed JSON / fails Zod** → `fetchRowViaAI` returns `null`; same path as Gateway error. Logged with the raw response for debugging.
- **Seed file has invalid YAML** → `loadSeedRows` logs the offending file path and skips it. Boot continues. Other rows still load. Surfaced in CI via a `tsx scripts/validate-seeds.ts` step.
- **Unknown `rowType` passed to `getRow`** → TypeScript prevents this at compile time. Runtime guard is redundant.
- **`extras` JSONB contains unknown fields on read** → `.safeParse()` strips them; resolver only sees known fields. Writes use `.parse()` to reject.

## Testing

Five layers, in priority order:

1. **Zod schema unit tests** — `tests/conditions/registry.test.ts`. For every entry in `ROW_TYPES`, assert the schema accepts a hand-written valid object and rejects a deliberately malformed one. Catches schema typos before they corrupt the cache.

2. **Registry coverage** — `tests/rules/registry-rows.test.ts`. For every flow in `REGISTRY`, call `requiredRows(fixtureFacts)` with a stock Facts object and assert it returns a non-empty list of `(type, key)` pairs where every `type` exists in `ROW_TYPES`. Catches "added a flow but forgot to declare its rows" regressions.

3. **`getRow` cache flow** — `tests/conditions/cache.test.ts`. Using a Postgres testcontainer (or a `pglite`-style in-memory Postgres):
   - cold miss → AI mock returns row → DB now has it, `getRow` returns AI-sourced data
   - second call same `(type, key)` → DB hit, AI not called
   - bump `expiresAt` to past → third call re-fetches via AI
   - seed row present → AI never called

4. **End-to-end resolution** — `tests/leg-resolution.test.ts`. Seed `visa_exemption:US:JP` with `exemptDays: 90`. Build a US→JP 9-night leg. Call `hydrateLeg` → assert `facts.tables.visa_exemption['US:JP'].exemptDays === 90`. Call `resolveFlow('preflight-jp', facts)` → assert `output['n-visa'].choiceId === 'no'`. This is the same shape as the rule layer spec's integration test, extended to include hydration.

5. **AI mocking** — All tests mock `src/lib/conditions/ai.ts`. Real Gateway calls are gated behind an integration suite that only runs in CI with credentials. Unit tests are deterministic.

We do not snapshot UI of the readiness indicator, the missing-row affordance, or rendered flowcharts. UI is its own concern.

## Out of scope

The following are explicitly deferred to separate specs. Each has a clean integration point against the data model defined here.

- **Auth provider.** `users.id` is the join key for `permanent_profile.userId` and `trip.userId`. Whatever the auth choice (Clerk, Auth0, next-auth, custom), it provides a user id and an email — nothing here changes when auth lands.

- **Onboarding UI.** A wizard or settings page that captures `permanent_profile` values is its own design. The Zod schemas defined here are the contract; the UI writes valid `PermanentProfile` and `ProfileExtras` shapes.

- **Planner-mode tables.** When the planner module ships, it adds `leg_option`, `deal_comparison`, point-balance tracking, and card-holdings tables. These attach to `trip.id` and `leg.id`. `permanent_profile.extras` already accommodates `cards` and `pointsProgs` for the parts the planner reads from the profile, with promotion to first-class columns when a resolver consumes them.

- **Background row refresh / staleness job.** v1 is lazy: rows are refreshed only when `getRow` is called past `expiresAt`. A cron that pre-warms popular `(type, key)` pairs, or invalidates rows when an underlying source publishes a change, is a v2 ergonomics improvement, not a correctness need.

- **Cross-citizenship optimization.** A dual-citizen with US+IE passports gets the best result per leg: `requiredRows` includes both `US:JP` and `IE:JP`, and the resolver picks the one with the higher `exemptDays`. More sophisticated multi-passport logic (e.g., minimizing visa cost across legs) is future.

- **Visual rendering of cascading conditions.** "Child nodes that appear on later legs when an earlier leg's resolution implies new conditions" is a flow-modal UI concern. The data supports it; the visual treatment is a separate UI spec.

- **Live re-resolution while a modal is open.** Per the rule layer spec, re-resolution happens on flow open. Subscribing to live profile changes is a future ergonomic improvement, not a correctness need.

- **Trip and Leg editing UI.** The CRUD surface for trips and legs is the organizer/planner UI's concern. This spec defines only the shapes those screens read from and write to.
