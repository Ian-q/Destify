# Rule Layer Design — Auto-Resolving Flow Choices

**Status:** approved spec, pending implementation plan
**Scope:** rule layer only. PermanentProfile and TripContext are typed inputs to this layer; their field shapes, persistence, and the About-Me onboarding flow are out of scope and will be designed in a separate spec.

## Problem

`FlowGraph`s in `src/lib/trip-data.ts` encode decision branches (e.g. "Need a Japan visa?"). Today, `useTripStore.flowChoices` is initialized from each node's `on: true` default and the user must click through every diamond manually. Most of those answers are derivable from facts the user has already given us elsewhere — citizenship, passport expiry, whether they're carrying controlled meds, whether they're driving at the destination. We want the flowchart to open with those decisions pre-filled, with clear provenance, and only prompt the user for nodes we genuinely cannot resolve.

We are explicitly not adopting `json-rules-engine`. At our scale (≈5–15 rules per flow, single-engineer authorship), a typed TS resolver function is more debuggable, type-checked at compile time, and gives better IDE support than runtime JSON evaluation. The "rules can be edited without redeploy" pitch of a JSON engine doesn't apply because rules ship in the app bundle either way.

## Architecture

Three pure-TS modules under `src/lib/rules/`:

1. **`facts.ts`** — `buildFacts(profile, context, leg) → Facts`. Single source of fact extraction. Each resolver consumes `Facts`, never the raw profile or context.
2. **Per-(country, flow) resolver files** (e.g. `jp/preflight.ts`) — each exports one `FlowResolver` function.
3. **`index.ts`** — exports `resolveFlow(flowId, profile, context, leg) → ResolverOutput`, which looks up the resolver in a typed registry and calls it with built facts.

Synchronous for now. If/when external lookups (e.g. Travel Buddy AI) land, we widen `FlowResolver` to return `ResolverOutput | Promise<ResolverOutput>`. Call sites are tied to React effects and are already async, so the surface change is small.

```
src/lib/rules/
├─ types.ts
├─ facts.ts
├─ index.ts          // registry + resolveFlow()
├─ jp/
│  ├─ preflight.ts   // resolvePreflightJP
│  ├─ domestic.ts
│  └─ return.ts
├─ ke/ ...
└─ sg/ ...
```

## Types

```ts
// src/lib/rules/types.ts

export type Leg = {
  from: string; to: string;            // ISO-3166
  startDate: string; endDate: string;  // ISO yyyy-mm-dd
};

// Union of every fact any resolver might consume. Resolvers get the whole
// object; per-flow narrowing isn't worth the ceremony at this scale.
export type Facts = {
  // From PermanentProfile
  citizenships: string[];
  controlledMeds: string[];   // names that require an import permit
  hasMinors: boolean;
  idp1949Valid: boolean;      // valid through end of leg
  idp1968Valid: boolean;
  // From TripContext (this trip)
  travelingWithMinors: boolean;
  drivingAtDestination: boolean;
  carryingControlledMeds: boolean;
  // From Leg
  fromCountry: string;
  toCountry: string;
  stayDays: number;
};

export type ResolvedChoice = {
  choiceId: string;
  ruleId: string;     // stable, dotted (e.g. "jp.preflight.visa.us-90d-exempt")
  reason: string;     // shown in the "From your profile" badge
};

export type ResolverOutput = Record<string, ResolvedChoice>; // nodeId → choice
export type FlowResolver = (facts: Facts) => ResolverOutput;
```

## Fact builder

`buildFacts` is the only place that interprets `PermanentProfile` and `TripContext` shapes. Resolvers stay thin and become testable with hand-written `Facts` fixtures rather than full profile objects. Two non-trivial transforms live here:

- **IDP validity** — combines convention type (`1949` vs `1968`) and expiry against the leg end date into the boolean facts `idp1949Valid` / `idp1968Valid`.
- **`stayDays`** — computed from `leg.startDate` and `leg.endDate`.

The builder always produces a complete `Facts` object. Missing inputs map to safe defaults (`false`, `[]`), never `undefined`. Resolvers therefore never see partial data.

## Resolver shape

Each resolver is a pure TS function. Rules are written as `if` blocks. Three patterns appear: simple single-fact, multi-fact `&&`, and dependent (one node's resolution depends on multiple facts).

```ts
// src/lib/rules/jp/preflight.ts
import type { Facts, FlowResolver, ResolverOutput } from "../types";

export const resolvePreflightJP: FlowResolver = (f): ResolverOutput => {
  const out: ResolverOutput = {};

  // n-visa — US passport + ≤90-day stay → visa-exempt
  if (f.citizenships.includes("US") && f.stayDays <= 90) {
    out["n-visa"] = {
      choiceId: "no",
      ruleId:   "jp.preflight.visa.us-90d-exempt",
      reason:   `US passport, ${f.stayDays}-night stay → visa-exempt up to 90 days`,
    };
  }

  // n-meds — controlled meds split off the Yakkan Shoumei branch
  if (f.carryingControlledMeds && f.controlledMeds.length > 0) {
    out["n-meds"] = {
      choiceId: "yes-controlled",
      ruleId:   "jp.preflight.meds.controlled",
      reason:   `${f.controlledMeds.join(", ")} requires a Yakkan Shoumei import certificate`,
    };
  } else if (f.carryingControlledMeds === false) {
    out["n-meds"] = {
      choiceId: "no",
      ruleId:   "jp.preflight.meds.none",
      reason:   "No prescription meds declared for this trip",
    };
  }

  // n-kids — driven by trip context, not profile
  if (f.travelingWithMinors === false) {
    out["n-kids"] = {
      choiceId: "no",
      ruleId:   "jp.preflight.kids.none",
      reason:   "No minors on this trip",
    };
  }

  // n-drive — dependent: resolve only when we know either "not driving" or
  // "driving with valid 1949 IDP". If driving without a known 1949 IDP, leave
  // unresolved so the user sees the prompt and learns about the 1949-vs-1968
  // distinction.
  if (f.drivingAtDestination === false) {
    out["n-drive"] = {
      choiceId: "no",
      ruleId:   "jp.preflight.drive.no",
      reason:   "Not driving in Japan — trains only",
    };
  } else if (f.drivingAtDestination && f.idp1949Valid) {
    out["n-drive"] = {
      choiceId: "yes",
      ruleId:   "jp.preflight.drive.idp1949",
      reason:   "Driving in Japan; you have a valid 1949-convention IDP",
    };
  }

  return out;
};
```

Three principles this shape enforces:

- **Absence ≠ negative.** A rule only fires when there is positive evidence. Unknown facts leave the node unresolved (user gets prompted), instead of silently picking a default.
- **`ruleId` is stable.** Tests and analytics assert on which rule fired, not just the choice. If "us-90d-exempt" splits, the analytics events split too.
- **`reason` is rendered verbatim** in the "From your profile" badge — write it as a sentence the user will read.

## Registry and entry point

```ts
// src/lib/rules/index.ts
import { resolvePreflightJP } from "./jp/preflight";
import { buildFacts } from "./facts";
import type {
  FlowResolver, Leg, ResolverOutput,
} from "./types";
import type { PermanentProfile, TripContext } from "@/lib/user-profile";

const REGISTRY: Record<string, FlowResolver> = {
  "preflight-jp": resolvePreflightJP,
  // "domestic-jp": resolveDomesticJP,
  // "return-jp":   resolveReturnJP,
};

export function resolveFlow(
  flowId: string,
  profile: PermanentProfile | null,
  context: TripContext | null,
  leg: Leg,
): ResolverOutput {
  if (!profile || !context) return {};
  const resolver = REGISTRY[flowId];
  if (!resolver) return {};
  try {
    return resolver(buildFacts(profile, context, leg));
  } catch (err) {
    console.error(`[rules] resolver for ${flowId} threw:`, err);
    return {};
  }
}
```

A buggy resolver, an unknown flow id, or a missing profile each degrade to "no auto-resolution, user sees defaults". The modal never breaks because of the rule layer.

## Store merge

Two new state fields and one new action in `useTripStore` (`src/lib/use-trip-store.ts`). Two existing actions change behavior.

```ts
type State = {
  // ... existing fields ...
  flowResolved: Record<string, ResolverOutput>;
  flowOverrides: Record<string, Record<string, string>>; // flowId → nodeId → choiceId
};

type Actions = {
  // ... existing actions ...
  applyResolution: (flowId: string, output: ResolverOutput) => void;
  resyncNode: (flowId: string, nodeId: string) => void;
};
```

`flowChoices` remains the single source of truth that `activePath()` reads from — it is not derived. Both auto-resolution and user clicks write into it. The two new fields are bookkeeping that records *why* each entry has its current value.

| Action | `flowChoices` | `flowResolved` | `flowOverrides` |
|---|---|---|---|
| `applyResolution(id, out)` | for every choice-bearing node, set `choices[nodeId] = overrides[id][nodeId] ?? out[nodeId]?.choiceId ?? defaultChoiceId(nodeId)` | replaced with `out` | unchanged |
| `setFlowChoice(id, n, c)` | `choices[n] = c` | unchanged | `overrides[id][n] = c` |
| `resyncNode(id, n)` | `choices[n] = resolved[id][n].choiceId` | unchanged | `delete overrides[id][n]` |
| `resetFlowChoices(id)` | re-applied via the same `applyResolution` formula above | unchanged | cleared |

This makes "manual wins" structural: in `applyResolution` the override is the first lookup in the precedence chain, so a buggy resolver cannot clobber user intent. It also handles the staleness case: if a rule that previously fired no longer fires, the un-overridden node falls through to its `on: true` default rather than retaining a now-orphaned auto-pick whose provenance has disappeared from `flowResolved`.

## When auto-resolution runs

In the `FlowGraphView` effect that already triggers on `flow.id` change, also call:

```ts
const out = resolveFlow(flow.id, profile, context, leg);
applyResolution(flow.id, out);
```

Opening the modal re-resolves. Profile changes therefore propagate on the next open. We do not subscribe to live profile changes in v1 — that is an ergonomic future improvement, not a correctness need.

## Re-sync hint and provenance badge

Both UI affordances are computed from existing state. No extra storage.

**Re-sync hint** — when the user has an override that disagrees with the current resolution:

```ts
function nodeNeedsResync(flowId: string, nodeId: string, store: State): boolean {
  const override = store.flowOverrides[flowId]?.[nodeId];
  const resolved = store.flowResolved[flowId]?.[nodeId];
  return !!override && !!resolved && override !== resolved.choiceId;
}
```

In the diamond node UI, render a small line under the choice chips: *"Profile says: **{resolvedLabel}** · [Sync]"*. Click calls `resyncNode`.

**Provenance badge** — when the choice came from resolution and is not overridden, render *"From your profile — {reason}"* near the choice chips. Reuses `resolved[node].reason` verbatim.

Both pieces of UI live in `flow-modal.tsx` and require no changes to the rule layer.

## Error handling

All failure modes degrade to "no auto-resolution; user sees defaults":

- **Unknown `flowId`** → `resolveFlow` returns `{}`.
- **Resolver throws** → wrapped in try/catch inside `resolveFlow`, logged to `console.error`, returns `{}`.
- **Missing profile or context** → callers pass `null`; `resolveFlow` short-circuits to `{}`. The "complete your profile to auto-fill" banner is a UI-layer concern, not the rule layer's job.
- **Partial facts** → `buildFacts` always produces a complete `Facts` object with safe defaults. Combined with the absence-≠-negative principle, missing data leaves nodes unresolved. There is never a silently wrong auto-pick.

## Testing

Three layers, in priority order:

1. **Per-resolver unit tests** — `tests/rules/jp-preflight.test.ts`. Fixture-based: hand-write 5–8 `Facts` objects covering canonical traveler types (US tourist, US tourist with controlled meds, EU tourist, family with minors, driver with 1949 IDP, driver without IDP). Assert each `ResolverOutput` includes the expected `{ choiceId, ruleId }` per node. `reason` strings are asserted via `toMatchInlineSnapshot` so wording changes are visible in diffs but not brittle.
2. **`buildFacts` test** — round-trip a known `(profile, context, leg)` → assert specific `Facts` fields. Covers IDP convention/expiry logic and `stayDays`, the only non-trivial transforms in the builder.
3. **Integration test** — `tests/flow-resolution.test.ts`. Build a known profile + context → `resolveFlow("preflight-jp", …)` → `activePath("preflight-jp", choices)` → assert the visible node sequence. This catches "rule layer disconnected from store" regressions end-to-end.

We do not test the merge logic in the store separately. The integration test exercises it. Snapshot tests on rendered flowchart visuals are out of scope for the rule layer.

## Out of scope

- `PermanentProfile` and `TripContext` field shapes, validation, and persistence (Postgres + Drizzle). Separate spec.
- About-Me onboarding wizard. Separate spec.
- External data sources (Travel Buddy AI, IATA Timatic). Separate spec; the resolver signature is forward-compatible (sync → sync-or-async widening described above).
- UI rendering of the provenance badge and re-sync hint inside `flow-modal.tsx`. The store contract this spec defines is sufficient input; the visual treatment is a small follow-on PR.
- Live re-resolution while the modal is open. Re-resolution happens on flow open. Live subscription is a future ergonomic improvement.
