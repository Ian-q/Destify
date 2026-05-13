# Info-card profile-driven content (Issue #14)

**Date:** 2026-05-12
**Issue:** [#14](https://github.com/Ian-q/Destify/issues/14)
**Status:** Design ready for implementation

## Goal

Make auto-resolved info-kind rectangle cards in flow modals (starting with `n-pass` on the preflight-jp flow) derive their content from the session profile and trip context, replacing the hardcoded fixture strings in `trip-data.ts`.

## Background

Issue #8 wired decision-node provenance: the resolver emits a `ResolverOutput` map of `{ choiceId, ruleId, reason }` per decision node, the store keeps it in `flowResolved`, and `DiamondNode` renders an "Auto" pill when the displayed choice matches the rule's verdict.

Info nodes (rectangle cards with `kind: 'info'`) skipped that wiring. Their title/desc/meta are still hardcoded in `src/lib/trip-data.ts`. The first card in the preflight flow always reads:

> Identity · auto
> US Passport · valid Aug 2029
> Japan requires 6 months past return — you have 3+ years. ✓ passed.

…regardless of whether the user is a US citizen, holds a different passport, or has no profile at all.

This spec extends the #8 provenance pattern to info nodes, and reshapes the profile to keep "who you are and where you live" cleanly isolated from "where this trip goes."

## Architecture

Three layers move:

### Rule layer

`ResolverOutput` splits into two maps:

```ts
type ResolverOutput = {
  choices: Record<string, ResolvedChoice>;  // existing decisions, renamed key
  info: Record<string, ResolvedInfo>;       // new
};

type ResolvedChoice = {
  choiceId: string;
  ruleId: string;
  reason: string;
};

type ResolvedInfo = {
  title: string;     // e.g. "US Passport · valid Aug 2029"
  desc: string;      // e.g. "Japan requires 6 months past return — you have 3+ years. ✓ passed."
  meta?: string;     // e.g. "Auto-checked from profile"
  state: 'pass' | 'warn' | 'fail';
  ruleId: string;
  reason: string;
};
```

The split (rather than a discriminated-union flat map) keeps consumer types tight: `flowResolved` and `flowInfo` each iterate without narrowing.

### Store layer

`useTripStore` gains a sibling map to `flowResolved`:

```ts
flowInfo: Record<string, Record<string, ResolvedInfo>>;
```

`applyResolution(flowId, output)` writes both maps. Stale-clear semantics match the #8 fix in `flowResolved`: on re-resolve, `flowInfo[flowId]` is replaced wholesale with `output.info`. Entries the new output omits drop out — `RectNode` then falls back to static trip-data content.

### UI layer

`RectNode` in `src/components/destify/flow-modal.tsx` reads `flowInfo[flowId][nodeId]` and prefers its strings over `data.title/desc/meta`. A small badge renders for `state === 'warn'` (folded with `fail` for now; #18 handles distinct visuals).

## Profile reshape

The existing `PermanentProfile` has `homeCountry: string | null` and `citizenships: string[]`. Both fields change:

```ts
// Before
{
  citizenships: ['US'],
  homeCountry: 'US',
  ...
}

// After
{
  citizenships: [{ country: 'US', passportExpiry: '2029-08-15' }],
  residence: { country: 'US', visaStatus: null },
  ...
}
```

Rationale:

- **`homeCountry` → `residence`**: "Home country" is ambiguous (birth? citizenship? tax? where you live?). Rules actually want to ask "where do you live, and on what legal basis?" `residence: { country, visaStatus? } | null` answers that directly. `visaStatus` is captured now but consumed by a separate issue (#17) for return-side re-entry rules.
- **`citizenships: string[]` → `citizenships: { country, passportExpiry }[]`**: Passport expiry is the data needed for #14's validity check. Embedding it in the citizenship record (instead of a parallel `passports[]` array) keeps the 1:1 invariant — every citizenship can carry its own passport metadata.

The "primary" passport is the first list entry (existing convention). Multi-citizenship best-passport picking is deferred to #16.

This shape forward-supports the complex layering case (e.g., US citizen on a Thai digital-nomad visa flying to Mongolia via Shanghai):

| Concern | Where it lives |
|---|---|
| Destination entry rules | `citizenships[0].country` |
| Layover transit-visa | Per-leg `via: string[]` (future, #15) |
| Return-side re-entry to residence | `residence.country` + `residence.visaStatus` (#17) |
| Passport validity check | `citizenships[0].passportExpiry` |
| Multi-citizenship optimization | Resolver picks best from `citizenships[]` (#16) |

The profile only knows **who you are and where you live**. The trip layer carries **where you're going and via where**. Rules combine them.

## Resolver: `n-pass` on preflight-jp

`src/lib/rules/jp/preflight.ts` gains a branch that emits into `out.info`. Pseudocode:

```ts
const primary = f.citizenships[0];
const returnDate = parseISO(f.leg.endDate);
const sixMonthsAfter = addMonths(returnDate, 6);

if (!primary) {
  out.info['n-pass'] = {
    title: 'No passport on file',
    desc: 'Add a citizenship to your profile to enable identity checks.',
    meta: 'Profile incomplete',
    state: 'warn',
    ruleId: 'jp.preflight.pass.missing',
    reason: 'No citizenships in profile',
  };
} else if (!primary.passportExpiry) {
  out.info['n-pass'] = {
    title: `${primary.country} Passport · expiry unknown`,
    desc: `Confirm your passport is valid 6+ months past return (${formatMonth(sixMonthsAfter)}).`,
    meta: 'Add expiry in profile to auto-check',
    state: 'warn',
    ruleId: 'jp.preflight.pass.no-expiry',
    reason: `${primary.country} citizenship has no expiry recorded`,
  };
} else if (parseISO(primary.passportExpiry) >= sixMonthsAfter) {
  out.info['n-pass'] = {
    title: `${primary.country} Passport · valid ${formatMonth(primary.passportExpiry)}`,
    desc: `Japan requires 6 months past return — you have ${gapText}. ✓ passed.`,
    meta: 'Auto-checked from profile',
    state: 'pass',
    ruleId: 'jp.preflight.pass.valid',
    reason: `${primary.country} passport expires ${primary.passportExpiry}, ≥ 6mo after return`,
  };
} else {
  out.info['n-pass'] = {
    title: `${primary.country} Passport · expires ${formatMonth(primary.passportExpiry)}`,
    desc: `Japan requires validity 6+ months past return (${formatMonth(sixMonthsAfter)}). Renew before flying.`,
    meta: 'Auto-check failed',
    state: 'fail',
    ruleId: 'jp.preflight.pass.expires-too-soon',
    reason: `${primary.country} passport expires ${primary.passportExpiry}, < 6mo after return`,
  };
}
```

`Facts` (in `src/lib/rules/types.ts`) gains:
- `citizenships: { country: string; passportExpiry: string | null }[]` (replacing `string[]`)
- `residence: { country: string; visaStatus: string | null } | null` (replacing `homeCountry`)
- `leg: Leg` (so the resolver can read `endDate` for the validity math)

Date math uses `date-fns` (already a dependency).

The 6-months-past-return rule is hardcoded in the JP resolver. When KE/MY/etc. land, it moves to a conditions table.

## Migration

A new Drizzle migration in `drizzle/migrations/` performs:

1. Add columns `residence_country text` and `residence_visa_status text` to `permanent_profile`.
2. Add column `citizenships_v2 jsonb default '[]'::jsonb not null` to `permanent_profile`.
3. Backfill `residence_country = home_country` and `citizenships_v2 = (select jsonb_agg(jsonb_build_object('country', c, 'passportExpiry', null)) from unnest(citizenships) as c)` for existing rows.
4. Drop `home_country` and `citizenships` (old text[]) columns.
5. Rename `citizenships_v2` → `citizenships`.

Existing rows are demo-grade; no production data at risk. Migration runs against Neon (prod) and pglite (tests) via the existing migrator.

## UI changes

### `RectNode` (`src/components/destify/flow-modal.tsx`)

Read dynamic content with fallback:

```ts
const info = flowInfo[data.flowId]?.[data.id];
const title = info?.title ?? data.title;
const desc = info?.desc ?? data.desc;
const meta = info?.meta ?? data.meta;
const state = info?.state;
```

Render a small amber dot before `data.label` when `state === 'warn'` or `state === 'fail'`. The `pass` state shows no extra badge — the existing sand background already reads as positive. The `'Add passport'` link appears in the desc body only when `state === 'warn'` and `ruleId` starts with `jp.preflight.pass.missing` or `jp.preflight.pass.no-expiry`.

### Onboarding wizard (`src/app/onboarding/wizard.tsx`)

Step 1 ("Citizenship"): for each selected citizenship, render an inline `<input type="date">` next to the country, label "Passport expiry (optional)." Submitting builds the new object shape.

Step 2 ("Home country" → "Country of residence"): same single-country picker. Append a small `<select>` "Visa status (optional)" with `Tourist | Permanent resident | Digital-nomad visa | Work visa | Other`. The select is captured but not yet rule-consumed (#17).

Step 3: unchanged.

### Profile settings (`src/app/profile/form.tsx`)

Mirrors the wizard: editable citizenship list with per-row expiry, residence picker with visa-status select.

## Trip-data fallback

`src/lib/trip-data.ts` keeps the static `n-pass` fields (`title`, `desc`, `meta`) as fallback content for when the resolver doesn't emit (e.g., resolver bug, or a future flow that intentionally leaves a card unresolved). `n-bag` (the other info node on preflight-jp, packing weight) is unchanged — it's not auto-resolved.

The hardcoded "US Passport · valid Aug 2029" text gets replaced with a generic placeholder like "Identity · pending" so a missing resolver result doesn't show false-confident content.

## Server boundary

`resolveFlowAction` and its `resolveFlow` test helper already derive profile, trip, leg, and context from the session cookie. The signature change is contained to:

1. `Facts` type — new fields.
2. `hydrateLeg` — populates the new fields from profile + leg.
3. `runResolver` — returns the new `{ choices, info }` shape.

Existing call sites destructuring `output` change from `output[nodeId]` to `output.choices[nodeId]`. The `applyResolution` action iterates `output.choices` for choice writes and writes `output.info` into the new `flowInfo` map.

No new server actions. No new DB queries beyond what `loadProfile` already returns (the new fields are part of the existing profile row).

## Error handling

- **Resolver missing fields**: if `facts.leg` is undefined (shouldn't happen post-migration), resolver skips `n-pass` entirely; `RectNode` falls back to static text. Guarded with a typescript-level requirement and a runtime check inside the resolver.
- **Profile null**: `DEFAULT_PROFILE` in `conditions/actions.ts` returns `citizenships: []`, `residence: null`. Resolver emits the "no passport on file" warn card.
- **Migration failure on existing user**: the migration includes safe defaults and runs in a transaction; failures roll back.

## Testing

Five test surfaces:

1. **`tests/preflight-resolver.test.ts`** (new): four unit cases for `n-pass`:
   - Valid passport (pass) — US, expiry 2029-08-15, return 2026-02-15
   - Expiring too soon (fail) — US, expiry 2026-04-01, return 2026-02-15
   - No expiry (warn) — US, expiry null
   - No citizenship (warn) — empty citizenships array
   Each asserts the full `ResolvedInfo` object (title, state, ruleId).

2. **`tests/profile-resolution.test.ts`** (extend acceptance test): after the US→KE citizenship swap currently tested for decisions, assert `result.output.info['n-pass'].title.startsWith('KE Passport')`.

3. **`tests/store-resolution.test.ts`** (extend): three new cases verifying `applyResolution` writes `flowInfo` and clears stale entries on re-resolve (same stale-clear discipline #8 added for `flowResolved`).

4. **`tests/profile-actions.zod.test.ts`** (extend): the new citizenship shape `{country, passportExpiry}` and the `residence` object parse correctly; malformed input rejects.

5. **Browser walkthrough** (per `feedback_test_browser_for_ui_features.md`):
   - Default demo user → preflight modal → `n-pass` shows "US Passport · valid Aug 2029" with pass styling
   - Swap citizenship to MY → close + reopen modal → `n-pass` updates to "MY Passport · ..."
   - Clear all citizenships → reopen → warn card with "Add passport" link
   - Set expiry to 2026-01-01 (before return + 6mo) → reopen → fail/warn copy renders
   - `n-bag` (packing weight) unchanged across all of the above

## Out of scope (filed for follow-up)

- Per-leg layover/transit-visa support — #15
- Multi-citizenship best-passport picker — #16
- `residence.visaStatus` driving return-side re-entry rules — #17
- `state='fail'` distinct visual treatment — #18
- Decision-node provenance UX expansion — #7
- Med-card / IDP-card analogues using the same info-emit pattern — those nodes already have decision-style outputs; whether they need info-card siblings is a separate design

## Acceptance criteria

- Switching citizenship in profile updates `n-pass` card's title (e.g., "MY Passport · …") on next modal open.
- Removing all citizenships causes `n-pass` to render a warn-state card with "Add passport to profile" call-to-action.
- Setting a passport expiry that fails the 6-months rule renders a fail-state card (visually folded into warn for now).
- A new unit test covers all four `n-pass` resolver branches.
- The acceptance test in `tests/profile-resolution.test.ts` asserts on `output.info['n-pass']` for both US and KE citizenship.
- `applyResolution` round-trips `flowInfo` writes and clears stale entries.
- The hardcoded "US Passport · valid Aug 2029" string is gone from `trip-data.ts`.
