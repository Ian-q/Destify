# Profile Capture & Session Design

**Status:** approved spec, pending implementation plan
**Scope:** the user/session layer beneath the existing data and rule layers ([2026-05-10-data-and-conditions-design.md](2026-05-10-data-and-conditions-design.md), [2026-05-07-rule-layer-design.md](2026-05-07-rule-layer-design.md)). Captures `permanent_profile` and `trip_context` via UI, persists to Neon, and migrates `resolveFlowAction` to derive profile/context server-side from a session cookie instead of accepting them as client arguments.

Tracks GitHub issue [#5](https://github.com/Ian-q/Destify/issues/5).

## Problem

The data and rule layers are end-to-end working, but every user sees the same flowchart resolution because `flow-modal.tsx` hard-codes `{ userId: 'demo', citizenships: ['US'], ... }` and passes it to `resolveFlowAction`. There is no user identity, no captured profile, and no per-trip context. The data spec foresaw this explicitly:

> Until auth and onboarding ship, the client passes hard-coded demo values; once auth lands, the action will derive `profile` and `context` server-side from the authenticated user instead of trusting the client. Treat the current shape as a temporary scaffold, not a long-term contract.

This spec ships the swap. Three concerns:

1. **Session** — a real (cookie + DB row) identity the server can trust, with a "bypass login" entry that creates an anonymous demo user. Auth provider integration stays out of scope; this is a swap-point.
2. **Capture UX** — a Tier-1 onboarding wizard on first visit and an always-available `/profile` settings page, plus an inline "Trip details" drawer in the organizer for `trip_context`.
3. **Server action migration** — `resolveFlowAction` drops its `profile`/`context`/`leg` arguments and reads them from the DB by session.

## Architecture

```
src/lib/
├─ session.ts               // getSessionUserId / requireSession (cookies API)
├─ auth-actions.ts          // 'use server' — signInDemoAction, signOutAction
├─ profile-actions.ts       // 'use server' — get/save profile and trip context
└─ conditions/actions.ts    // existing; resolveFlowAction migrated to (flowId)

src/app/
├─ login/page.tsx           // bypass-login button calls signInDemoAction
├─ onboarding/page.tsx      // 3-step Tier-1 wizard (new)
├─ profile/page.tsx         // settings page (new)
└─ organizer/page.tsx       // server component checks session + redirects

src/components/destify/
├─ trip-details-drawer.tsx  // Radix Sheet, opens from trip-header (new)
├─ trip-header.tsx          // adds "Trip details" pill button
├─ topbar.tsx               // avatar becomes a menu (Edit profile / Sign out)
└─ flow-modal.tsx           // removes hardcoded profile/context literal
```

The data and rule layer source files are untouched. The only change inside `src/lib/conditions/` is `actions.ts` (signature change). All new persistence goes through the existing Drizzle client.

## Session

### `src/lib/session.ts`

Server-only module. Reads the httpOnly cookie `destify-session` via Next 16's `cookies()` from `next/headers`.

```ts
export async function getSessionUserId(): Promise<string | null>;
export async function requireSession(): Promise<string>; // throws if absent
```

Cookie config: `path=/`, `httpOnly`, `sameSite: 'lax'`, `secure` in production, `maxAge: 60 * 60 * 24 * 365` (one year). Value is the `users.id` UUID.

### `src/lib/auth-actions.ts`

```ts
'use server';

export async function signInDemoAction(): Promise<{ userId: string; tripId: string }>;
export async function signOutAction(): Promise<void>;
```

`signInDemoAction` is idempotent:

1. Read the existing cookie. If it resolves to a valid `users` row, return that user's existing trip (re-using the most recent one).
2. Otherwise, in a single transaction:
   - Insert `users { email: 'demo-<shortid>@destify.local' }` and capture the id.
   - Insert one `trip { userId, name: 'Japan demo', startDate, endDate, status: 'planning' }`.
   - Insert three `leg` rows seeded from `src/lib/trip-data.ts` (US→JP outbound + 1 domestic + JP→US return — exact seq/dates lifted from the existing fixture so the UI stays coherent).
   - Insert one `trip_context { tripId }` with column defaults.
3. Set the cookie. Return `{ userId, tripId }`.

`signOutAction` clears the cookie. It does **not** delete the `users` row; demo data persists in case the same browser signs back in.

The login page's submit / social / "Skip — try the demo" buttons all call `signInDemoAction()` then `router.push('/organizer')`. The localStorage flag from issue #6 is removed in this work (it served as a placeholder).

## Capture UX

### Onboarding wizard `/onboarding`

Three steps, Tier-1 only. Layout follows existing design tokens (cream background, sage/ocean gradients, segmented controls).

| # | Step | Fields | Notes |
|---|---|---|---|
| 1 | Identity | `citizenships[]` (multi-chip input, ISO-3166 alpha-2 search), `homeCountry` (single select), `hasMinors` (yes/no) | Skippable; defaults: `[]`, `null`, `false` |
| 2 | Driving | `idpConvention` (segmented: `1949` / `1968` / "I don't drive abroad"), `idpExpiry` (date, only when convention set) | Hidden if user picks "I don't drive abroad"; in that case `idpConvention` and `idpExpiry` both persist as `null` |
| 3 | Health & family | `controlledMeds[]` (free-text chips with add/remove) | `hasMinors` already captured in step 1 |

Footer: `Back · Skip · Continue` for steps 1–2; `Back · Skip · Finish` for step 3. Progress dots top-center.

`Skip` from any step writes whatever has been entered so far (via `saveProfileAction`) and routes to `/organizer` — partial-fills are valid because every field is nullable or has a default. `Finish` does the same write and routes to `/organizer`.

Country pickers use a static JSON list bundled in `src/lib/iso-countries.ts` (alpha-2 + display name). Not a separate API.

### Settings page `/profile`

Single page, not a wizard. Three section headers matching the wizard steps; all Tier-1 fields editable in one form. Save button at bottom; success toasts via the toast component shipped in #6.

Below Tier-1, five Tier-2 sections render with a "Coming soon" badge and disabled inputs — `Cards`, `Points programs`, `Dietary`, `Allergies`, `Mobility`. Copy follows #6's stub pattern (label + toast on attempted interaction). The Zod schema (`ProfileExtras.strict()`) is already in place; only the UI is deferred.

Avatar in `topbar.tsx` becomes a menu:
- `Edit profile` → `/profile`
- `Sign out` → `signOutAction()` + `router.push('/login')`

### Trip details drawer

New `src/components/destify/trip-details-drawer.tsx`. Uses Radix Sheet (already in deps). Opens from a new "Trip details" pill in `trip-header.tsx`, sibling to the existing "Trip readiness" card.

Form contents:
- Three yes/no toggles: `travelingWithMinors`, `drivingAtDestination`, `carryingControlledMeds`
- Segmented control: `purpose` (tourism / business / family / study)

Save calls `saveTripContextAction(tripId, input)`, closes drawer, fires a toast.

### First-visit redirect

In `/organizer/page.tsx` (server component), at the top:

```ts
const userId = await getSessionUserId();
if (!userId) redirect('/login');
const profile = await loadProfile(userId);
if (!profile) redirect('/onboarding');
```

`/login` is reachable without a session. `/onboarding` and `/profile` require a session (each checks `requireSession()` server-side; if absent → `redirect('/login')`).

## Server actions

### `src/lib/profile-actions.ts`

```ts
'use server';

const Tier1ProfileInput = z.object({
  citizenships:   z.array(z.string().length(2)),
  homeCountry:    z.string().length(2).nullable(),
  idpConvention:  z.enum(['1949', '1968']).nullable(),
  idpExpiry:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  controlledMeds: z.array(z.string().min(1)),
  hasMinors:      z.boolean(),
  extras:         ProfileExtras.optional(),  // stays `{}` for v1
}).strict();

const TripContextInput = z.object({
  travelingWithMinors:    z.boolean(),
  drivingAtDestination:   z.boolean(),
  carryingControlledMeds: z.boolean(),
  purpose:                z.enum(['tourism', 'business', 'family', 'study']).nullable(),
  extras:                 TripContextExtras.optional(),
}).strict();

export async function getProfileAction(): Promise<PermanentProfile | null>;
export async function saveProfileAction(input: z.input<typeof Tier1ProfileInput>): Promise<void>;
export async function getTripContextAction(tripId: string): Promise<TripContext | null>;
export async function saveTripContextAction(tripId: string, input: z.input<typeof TripContextInput>): Promise<void>;
```

All four call `requireSession()` first. `getTripContextAction` and `saveTripContextAction` additionally verify the supplied `tripId` is owned by the session user via a `SELECT 1 FROM trip WHERE id=$1 AND user_id=$2` guard — a leaked tripId from one cookie cannot read/write another's data.

`saveProfileAction` upserts: `INSERT … ON CONFLICT (user_id) DO UPDATE SET …, updated_at = now()`. Same shape for `saveTripContextAction` keyed on `tripId`.

### `resolveFlowAction` migration

Old: `resolveFlowAction(flowId, profile, context, leg)`.
New: `resolveFlowAction(flowId)`. The server derives everything.

```ts
export async function resolveFlowAction(flowId: string) {
  const userId = await requireSession();
  const profile = await loadProfile(userId);            // returns defaults if row missing
  const trip    = await loadActiveTrip(userId);         // user's most recent trip
  const leg     = await loadLegForFlow(trip.id, flowId);
  const context = await loadTripContext(trip.id);
  const { facts, missing } = await hydrateLeg(profile, context, leg, { flowId });
  const output  = resolveFlow(flowId, profile, context, leg, { tables: facts.tables });
  return { output, missing, leg };
}
```

`loadLegForFlow(tripId, flowId)` is a small flow-to-leg-seq lookup. A `FLOW_LEG_SEQ` constant lives next to the existing `REGISTRY` in `src/lib/rules/index.ts` since flow→leg ownership is a rule-layer concept:

```ts
const FLOW_LEG_SEQ: Record<string, number> = {
  'preflight-jp': 0,   // outbound US→JP
  'domestic-jp':  1,   // domestic JP leg
  'return-jp':    2,   // return JP→US
};
```

`loadProfile` returns synthetic defaults (`citizenships: []`, `hasMinors: false`, etc.) when no row exists — matches the absence-≠-negative principle. The resolver simply auto-resolves fewer nodes; nothing crashes.

`flow-modal.tsx`'s call site collapses to:

```ts
const { output, missing } = await resolveFlowAction(flow.id);
applyResolution(flow.id, output);
setMissing(missing);
```

The hardcoded `{ userId: 'demo', citizenships: ['US'], … }` literal at L237 is removed entirely.

## Data flow

```
sign-in
─────────────────────────────────────────────────────────────────
[bypass-login button] → signInDemoAction()
                          ├─ INSERT users
                          ├─ INSERT trip + 3 legs + trip_context
                          └─ set destify-session cookie
                        → router.push('/organizer')

first organizer load (no profile yet)
─────────────────────────────────────────────────────────────────
/organizer (server component) → getSessionUserId()
                               → loadProfile(userId) returns null
                               → redirect('/onboarding')

wizard finish
─────────────────────────────────────────────────────────────────
[Finish button] → saveProfileAction(input)
                  ├─ requireSession()
                  ├─ Tier1ProfileInput.parse(input)
                  └─ UPSERT permanent_profile
                → router.push('/organizer')

flow modal open
─────────────────────────────────────────────────────────────────
[FlowGraphView useEffect] → resolveFlowAction(flow.id)
                            ├─ requireSession()
                            ├─ SELECT permanent_profile, trip, leg, trip_context
                            ├─ hydrateLeg + resolveFlow
                            └─ return { output, missing, leg }
                          → applyResolution(flow.id, output)
```

## Error handling

- **`getSessionUserId` returns null in an action that requires it** → `requireSession()` throws; Next.js surfaces the error; calling page redirects to `/login`.
- **Cookie present but `users` row gone** (manually deleted) → `loadProfile` / `loadActiveTrip` returns null; on `/organizer` server load, `redirect('/login')` after a `signOutAction`. On any action, throws — same recovery.
- **Zod validation failure in `saveProfileAction` / `saveTripContextAction`** → throw; client surfaces via a generic "Couldn't save — please check your inputs" toast.
- **`loadLegForFlow` returns undefined for an unrecognized `flowId`** → throw a typed error; client surfaces a "Flow not configured" banner. Should never happen in normal use since `flow.id` comes from the registry.
- **Onboarding redirect loop** — guard: `/onboarding` server component checks `if (await loadProfile(userId)) redirect('/organizer')`. So after a save, returning to `/onboarding` directly bounces to organizer.
- **`saveTripContextAction` called with a `tripId` not owned by the session user** → throw a typed `Forbidden` error. Client toasts.

## Testing

Five layers, in priority order:

1. **Session unit tests** — `tests/session.test.ts`. Mock `next/headers` `cookies()`. Assert `getSessionUserId` returns the cookie value, returns null when absent, and that `requireSession` throws. Pure logic; no DB.

2. **Zod schemas** — `tests/profile-actions.zod.test.ts`. `Tier1ProfileInput` and `TripContextInput`. Assert good shapes pass, malformed shapes are rejected (unknown fields rejected by `.strict()`).

3. **`signInDemoAction` integration** — `tests/auth-actions.test.ts` against pglite (existing test DB). First call inserts users/trip/legs/context; second call with the cookie reuses the same user. Two distinct browsers → two distinct users.

4. **End-to-end profile-driven resolution** — `tests/profile-resolution.test.ts`. Seed `visa_exemption:US:JP` and `visa_exemption:KE:JP` (the latter omitted — no row means visa required). Insert a user with `citizenships: ['KE']`, a US→JP leg, and a trip_context. Call `resolveFlowAction('preflight-jp')` → assert `output['n-visa']` is not auto-resolved. Update profile to `citizenships: ['US']`, re-call → assert `output['n-visa'].choiceId === 'no'`. This is the issue's acceptance criterion expressed as a test.

5. **All existing 31 tests must still pass.** The rule layer is unchanged; only the action signature changes. Existing rule-layer tests don't call `resolveFlowAction` directly — they call `resolveFlow` — so they're unaffected.

We do not snapshot wizard or profile UIs. Manual walkthrough acceptance: bypass-login → onboarding → fill citizenships → land on organizer → open preflight modal → confirm `n-visa` auto-resolves. Then change to `KE` in `/profile` → reopen modal → `n-visa` no longer auto-resolved.

## Out of scope

The following are explicitly deferred. Each has a clean integration point against the data model and surface defined here.

- **Real auth provider (Clerk / next-auth / Auth0).** `signInDemoAction` is the swap point. The cookie shape and `users` row keying stay the same. Email collection at sign-up is the only material UX change.
- **Tier-2 Extras UI** (cards, points, dietary, allergies, mobility). Schema is ready (`ProfileExtras.strict()`); form is the only missing piece. Likely lands when planner mode begins consuming the data.
- **Multi-trip CRUD.** `signInDemoAction` seeds one trip per user. "+ New trip", "Switch trip", and "Delete trip" all live in a future organizer-enhancement issue.
- **Per-leg trip context overrides.** `trip_context` is per-trip by design (data spec). Leg-specific override fields, if needed, add columns to `leg` or a new `leg_context` table — out of scope here.
- **Live re-resolution while a flow modal is open** (already out of scope in the rule layer + data specs). Profile edits propagate on next flow-modal open.
- **Email/password validation in onboarding.** Demo users get auto-generated emails. When real auth lands, the wizard step 0 becomes "Sign up with email" and `signInDemoAction` is replaced.
- **Profile-change audit log.** v1 just upserts; no `profile_history` table.
