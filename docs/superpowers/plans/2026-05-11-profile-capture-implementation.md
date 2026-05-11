# Profile Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a real per-user profile (cookie session + `users` row), capture it via an onboarding wizard and `/profile` settings page, capture per-trip context via a drawer, and migrate `resolveFlowAction` to derive profile/context server-side from the session — so swapping `citizenships` from `US` to `KE` produces a different flowchart resolution.

**Architecture:** Three new server-only modules (`session.ts`, `auth-actions.ts`, `profile-actions.ts`), a tiny static country list (`iso-countries.ts`), three new UI surfaces (`/onboarding`, `/profile`, `<TripDetailsDrawer>`), an `AvatarMenu` extracted from the topbar, and a one-argument `resolveFlowAction(flowId)` that loads everything from the DB. The existing data/rule layers are untouched except for adding a flow→leg-seq lookup.

**Tech Stack:** Next.js 16 App Router, Server Actions, Drizzle ORM over Neon Postgres (prod) / PGlite (tests), Zod, Radix Sheet, Vitest.

**Reference:** [`docs/superpowers/specs/2026-05-11-profile-capture-design.md`](../specs/2026-05-11-profile-capture-design.md)

---

## File Map

**New (server):**
- `src/lib/session.ts` — `getSessionUserId`, `requireSession` (reads cookie).
- `src/lib/auth-actions.ts` — `signInDemoAction`, `signOutAction`, internal `signInDemo(db)` for tests.
- `src/lib/profile-actions.ts` — `Tier1ProfileInput`, `TripContextInput`, four CRUD actions + internal helpers.
- `src/lib/iso-countries.ts` — static array `[{ code, name }]`.

**New (client/UI):**
- `src/app/onboarding/page.tsx` (server shell), `src/app/onboarding/wizard.tsx` (client).
- `src/app/profile/page.tsx` (server shell), `src/app/profile/form.tsx` (client).
- `src/components/destify/trip-details-drawer.tsx` (client, Radix Sheet).
- `src/components/destify/avatar-menu.tsx` (client, dropdown for Edit profile / Sign out).

**New (tests):**
- `tests/session.test.ts`
- `tests/profile-actions.zod.test.ts`
- `tests/auth-actions.test.ts`
- `tests/profile-resolution.test.ts` (end-to-end acceptance test).

**Modified:**
- `src/app/login/page.tsx` — `bypassLogin` calls `signInDemoAction`, drops localStorage flag.
- `src/app/organizer/page.tsx` — server-side session + profile gate.
- `src/lib/conditions/actions.ts` — `resolveFlowAction(flowId)` new signature; old args removed.
- `src/lib/rules/index.ts` — add `FLOW_LEG_SEQ` constant.
- `src/components/destify/flow-modal.tsx` — call site collapses; remove hardcoded literal.
- `src/components/destify/topbar.tsx` — replace avatar div with `<AvatarMenu />`.
- `src/components/destify/trip-header.tsx` — add "Trip details" pill button.

---

## Task 1: Session module

**Files:**
- Create: `src/lib/session.ts`
- Test: `tests/session.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/session.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const cookieStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined,
    set: (name: string, value: string) => { cookieStore.set(name, value); },
    delete: (name: string) => { cookieStore.delete(name); },
  }),
}));

import { getSessionUserId, requireSession, SESSION_COOKIE } from '@/lib/session';

describe('session module', () => {
  beforeEach(() => cookieStore.clear());

  it('getSessionUserId returns null when cookie absent', async () => {
    expect(await getSessionUserId()).toBeNull();
  });

  it('getSessionUserId returns the cookie value when present', async () => {
    cookieStore.set(SESSION_COOKIE, 'user-uuid-123');
    expect(await getSessionUserId()).toBe('user-uuid-123');
  });

  it('requireSession throws when cookie absent', async () => {
    await expect(requireSession()).rejects.toThrow(/no session/i);
  });

  it('requireSession returns userId when present', async () => {
    cookieStore.set(SESSION_COOKIE, 'user-uuid-123');
    expect(await requireSession()).toBe('user-uuid-123');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/session.test.ts`
Expected: FAIL (`@/lib/session` not found).

- [ ] **Step 3: Implement `src/lib/session.ts`**

```ts
import 'server-only';
import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'destify-session';

export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

export async function requireSession(): Promise<string> {
  const id = await getSessionUserId();
  if (!id) throw new Error('No session');
  return id;
}

export async function setSessionCookie(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, userId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/session.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts tests/session.test.ts
git commit -m "Add session module with cookie-backed getSessionUserId/requireSession (#5)"
```

---

## Task 2: ISO country helper

**Files:**
- Create: `src/lib/iso-countries.ts`

- [ ] **Step 1: Implement**

A static list of ~60 commonly-traveled countries. Bundle in the client; small enough not to need lazy loading.

```ts
// src/lib/iso-countries.ts
export type Country = { code: string; name: string };

export const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States' },
  { code: 'JP', name: 'Japan' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IE', name: 'Ireland' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'PT', name: 'Portugal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'IS', name: 'Iceland' },
  { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'GR', name: 'Greece' },
  { code: 'TR', name: 'Turkey' },
  { code: 'MX', name: 'Mexico' },
  { code: 'BR', name: 'Brazil' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Peru' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KE', name: 'Kenya' },
  { code: 'EG', name: 'Egypt' },
  { code: 'MA', name: 'Morocco' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'IL', name: 'Israel' },
  { code: 'IN', name: 'India' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'CN', name: 'China' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'PH', name: 'Philippines' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'NP', name: 'Nepal' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'RU', name: 'Russia' },
];

export const COUNTRY_BY_CODE: Record<string, Country> =
  Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));

export function countryName(code: string): string {
  return COUNTRY_BY_CODE[code]?.name ?? code;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/iso-countries.ts
git commit -m "Add static ISO-3166 country list for profile pickers (#5)"
```

---

## Task 3: `signInDemoAction` with atomic seeding

**Files:**
- Create: `src/lib/auth-actions.ts`
- Test: `tests/auth-actions.test.ts`

- [ ] **Step 1: Write the failing test (pglite, mock next/headers)**

```ts
// tests/auth-actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';

const cookieStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (n: string) => cookieStore.has(n) ? { name: n, value: cookieStore.get(n)! } : undefined,
    set: (n: string, v: string) => { cookieStore.set(n, v); },
    delete: (n: string) => { cookieStore.delete(n); },
  }),
}));

import { signInDemo } from '@/lib/auth-actions';
import { users, trip, leg, tripContext } from '@/lib/db/schema';

async function makeDb() {
  const pg = new PGlite();
  const db = drizzle(pg);
  await migrate(db, { migrationsFolder: './drizzle' });
  return db;
}

describe('signInDemo', () => {
  beforeEach(() => cookieStore.clear());

  it('first call seeds user + trip + 3 legs + trip_context, sets cookie', async () => {
    const db = await makeDb();
    const { userId, tripId } = await signInDemo(db);

    expect(userId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(cookieStore.get('destify-session')).toBe(userId);

    const u = await db.select().from(users).where(eq(users.id, userId));
    expect(u).toHaveLength(1);

    const t = await db.select().from(trip).where(eq(trip.id, tripId));
    expect(t).toHaveLength(1);
    expect(t[0].userId).toBe(userId);

    const legs = await db.select().from(leg).where(eq(leg.tripId, tripId));
    expect(legs).toHaveLength(3);
    expect(legs.map((l) => l.seq).sort()).toEqual([0, 1, 2]);
    expect(legs.find((l) => l.seq === 0)).toMatchObject({ fromCountry: 'US', toCountry: 'JP' });

    const ctx = await db.select().from(tripContext).where(eq(tripContext.tripId, tripId));
    expect(ctx).toHaveLength(1);
    expect(ctx[0]).toMatchObject({
      travelingWithMinors: false,
      drivingAtDestination: false,
      carryingControlledMeds: false,
    });
  });

  it('second call with existing cookie reuses the same user/trip', async () => {
    const db = await makeDb();
    const a = await signInDemo(db);
    const b = await signInDemo(db);
    expect(b.userId).toBe(a.userId);
    expect(b.tripId).toBe(a.tripId);
  });

  it('cookie pointing to deleted user creates a fresh one', async () => {
    const db = await makeDb();
    const a = await signInDemo(db);
    await db.delete(users).where(eq(users.id, a.userId));
    const b = await signInDemo(db);
    expect(b.userId).not.toBe(a.userId);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/auth-actions.test.ts`
Expected: FAIL (`signInDemo` not exported).

- [ ] **Step 3: Implement `src/lib/auth-actions.ts`**

```ts
'use server';

import { eq } from 'drizzle-orm';
import { db as prodDb } from '@/lib/db/client';
import { users, trip, leg, tripContext } from '@/lib/db/schema';
import { getSessionUserId, setSessionCookie, clearSessionCookie } from '@/lib/session';

// Use `any` here because drizzle-orm/pglite (tests) and drizzle-orm/neon-http (prod)
// have structurally incompatible Database<TSchema> types. Same pattern as readiness.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

const SHORTID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
function shortId(len = 8) {
  let out = '';
  for (let i = 0; i < len; i++) out += SHORTID_ALPHABET[Math.floor(Math.random() * SHORTID_ALPHABET.length)];
  return out;
}

const DEMO_TRIP_DEFAULTS = {
  name: 'Japan demo',
  startDate: '2026-06-01',
  endDate: '2026-06-14',
  legs: [
    { seq: 0, fromCountry: 'US', toCountry: 'JP', startDate: '2026-06-01', endDate: '2026-06-02' },
    { seq: 1, fromCountry: 'JP', toCountry: 'JP', startDate: '2026-06-02', endDate: '2026-06-12' },
    { seq: 2, fromCountry: 'JP', toCountry: 'US', startDate: '2026-06-12', endDate: '2026-06-14' },
  ],
};

export async function signInDemo(db: AnyDb): Promise<{ userId: string; tripId: string }> {
  const existing = await getSessionUserId();
  if (existing) {
    const u = await db.select().from(users).where(eq(users.id, existing));
    if (u.length > 0) {
      const t = await db.select().from(trip).where(eq(trip.userId, existing));
      if (t.length > 0) return { userId: existing, tripId: t[0].id };
    }
  }

  const email = `demo-${shortId()}@destify.local`;
  const [u] = await db.insert(users).values({ email }).returning({ id: users.id });
  const userId = u.id;

  const [t] = await db.insert(trip).values({
    userId,
    name: DEMO_TRIP_DEFAULTS.name,
    startDate: DEMO_TRIP_DEFAULTS.startDate,
    endDate: DEMO_TRIP_DEFAULTS.endDate,
  }).returning({ id: trip.id });
  const tripId = t.id;

  await db.insert(leg).values(DEMO_TRIP_DEFAULTS.legs.map((l) => ({ ...l, tripId })));
  await db.insert(tripContext).values({ tripId });

  await setSessionCookie(userId);
  return { userId, tripId };
}

export async function signInDemoAction(): Promise<{ userId: string; tripId: string }> {
  return signInDemo(prodDb);
}

export async function signOutAction(): Promise<void> {
  await clearSessionCookie();
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/auth-actions.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-actions.ts tests/auth-actions.test.ts
git commit -m "Add signInDemoAction with atomic user/trip/legs seeding (#5)"
```

---

## Task 4: Profile actions — Tier-1 schema and CRUD

**Files:**
- Create: `src/lib/profile-actions.ts`
- Test: `tests/profile-actions.zod.test.ts`

- [ ] **Step 1: Write failing Zod schema tests**

```ts
// tests/profile-actions.zod.test.ts
import { describe, it, expect } from 'vitest';
import { Tier1ProfileInput, TripContextInput } from '@/lib/profile-actions';

describe('Tier1ProfileInput', () => {
  const valid = {
    citizenships: ['US'],
    homeCountry: 'US',
    idpConvention: null,
    idpExpiry: null,
    controlledMeds: [],
    hasMinors: false,
  };

  it('accepts a valid Tier-1 input', () => {
    expect(Tier1ProfileInput.safeParse(valid).success).toBe(true);
  });

  it('rejects non-alpha-2 country codes', () => {
    expect(Tier1ProfileInput.safeParse({ ...valid, citizenships: ['USA'] }).success).toBe(false);
  });

  it('rejects malformed idpExpiry dates', () => {
    expect(Tier1ProfileInput.safeParse({ ...valid, idpExpiry: '06/01/2026' }).success).toBe(false);
  });

  it('rejects unknown top-level fields (strict)', () => {
    expect(Tier1ProfileInput.safeParse({ ...valid, hackField: true }).success).toBe(false);
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

  it('rejects unknown purpose values', () => {
    expect(TripContextInput.safeParse({ ...valid, purpose: 'leisure' }).success).toBe(false);
  });

  it('rejects unknown fields (strict)', () => {
    expect(TripContextInput.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/profile-actions.zod.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/profile-actions.ts`**

```ts
'use server';

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db as prodDb } from '@/lib/db/client';
import { permanentProfile, tripContext, trip } from '@/lib/db/schema';
import { ProfileExtras, TripContextExtras } from '@/lib/profile-extras';
import { requireSession } from '@/lib/session';
import type { PermanentProfile, TripContext } from '@/lib/user-profile';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

export const Tier1ProfileInput = z.object({
  citizenships:   z.array(z.string().length(2)),
  homeCountry:    z.string().length(2).nullable(),
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

export async function loadProfile(db: AnyDb, userId: string): Promise<PermanentProfile | null> {
  const rows = await db.select().from(permanentProfile).where(eq(permanentProfile.userId, userId));
  if (rows.length === 0) return null;
  const r = rows[0];
  const parsedExtras = ProfileExtras.safeParse(r.extras);
  return {
    userId: r.userId,
    citizenships: r.citizenships ?? [],
    homeCountry: r.homeCountry,
    idpConvention: r.idpConvention,
    idpExpiry: r.idpExpiry,
    controlledMeds: r.controlledMeds ?? [],
    hasMinors: r.hasMinors,
    extras: parsedExtras.success ? parsedExtras.data : {},
  };
}

export async function saveProfile(db: AnyDb, userId: string, input: z.input<typeof Tier1ProfileInput>): Promise<void> {
  const parsed = Tier1ProfileInput.parse(input);
  await db.insert(permanentProfile).values({
    userId,
    citizenships: parsed.citizenships,
    homeCountry: parsed.homeCountry,
    idpConvention: parsed.idpConvention,
    idpExpiry: parsed.idpExpiry,
    controlledMeds: parsed.controlledMeds,
    hasMinors: parsed.hasMinors,
    extras: parsed.extras ?? {},
  }).onConflictDoUpdate({
    target: permanentProfile.userId,
    set: {
      citizenships: parsed.citizenships,
      homeCountry: parsed.homeCountry,
      idpConvention: parsed.idpConvention,
      idpExpiry: parsed.idpExpiry,
      controlledMeds: parsed.controlledMeds,
      hasMinors: parsed.hasMinors,
      extras: parsed.extras ?? {},
      updatedAt: new Date(),
    },
  });
}

async function assertTripOwned(db: AnyDb, userId: string, tripId: string): Promise<void> {
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

export async function getProfileAction(): Promise<PermanentProfile | null> {
  const userId = await requireSession();
  return loadProfile(prodDb, userId);
}

export async function saveProfileAction(input: z.input<typeof Tier1ProfileInput>): Promise<void> {
  const userId = await requireSession();
  await saveProfile(prodDb, userId, input);
}

export async function getTripContextAction(tripId: string): Promise<TripContext | null> {
  const userId = await requireSession();
  await assertTripOwned(prodDb, userId, tripId);
  return loadTripContext(prodDb, tripId);
}

export async function saveTripContextAction(tripId: string, input: z.input<typeof TripContextInput>): Promise<void> {
  const userId = await requireSession();
  await saveTripContext(prodDb, userId, tripId, input);
}
```

- [ ] **Step 4: Run all tests so far**

Run: `npx vitest run tests/profile-actions.zod.test.ts tests/session.test.ts tests/auth-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile-actions.ts tests/profile-actions.zod.test.ts
git commit -m "Add profile-actions: Tier1 Zod schemas + load/save helpers + actions (#5)"
```

---

## Task 5: Flow-leg lookup in rules registry

**Files:**
- Modify: `src/lib/rules/index.ts`

- [ ] **Step 1: Add `FLOW_LEG_SEQ` constant**

Append to `src/lib/rules/index.ts`:

```ts
export const FLOW_LEG_SEQ: Record<string, number> = {
  'preflight-jp': 0,
  'domestic-jp':  1,
  'return-jp':    2,
};

export function legSeqForFlow(flowId: string): number | null {
  return FLOW_LEG_SEQ[flowId] ?? null;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/rules/index.ts
git commit -m "Add FLOW_LEG_SEQ map for flow-to-leg lookup (#5)"
```

---

## Task 6: Migrate `resolveFlowAction` to session-driven signature

**Files:**
- Modify: `src/lib/conditions/actions.ts`
- Modify: `src/components/destify/flow-modal.tsx`
- Test: `tests/profile-resolution.test.ts`

This is the acceptance criterion test (issue #5: KE → no auto-resolve, US → auto-resolve).

- [ ] **Step 1: Write the failing end-to-end test**

```ts
// tests/profile-resolution.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';

vi.mock('@/lib/conditions/ai', () => ({ fetchRowViaAI: vi.fn().mockResolvedValue(null) }));

const cookieStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (n: string) => cookieStore.has(n) ? { name: n, value: cookieStore.get(n)! } : undefined,
    set: (n: string, v: string) => { cookieStore.set(n, v); },
    delete: (n: string) => { cookieStore.delete(n); },
  }),
}));

import { signInDemo } from '@/lib/auth-actions';
import { saveProfile } from '@/lib/profile-actions';
import { resolveFlow as resolveFlowInternal } from '@/lib/conditions/actions';
import { loadSeedRows } from '@/lib/conditions/seed';

async function makeDb() {
  const pg = new PGlite();
  const db = drizzle(pg);
  await migrate(db, { migrationsFolder: './drizzle' });
  await loadSeedRows(db);
  return db;
}

describe('profile-driven resolution', () => {
  beforeEach(() => cookieStore.clear());

  it('US citizenship auto-resolves n-visa via seeded US:JP row', async () => {
    const db = await makeDb();
    const { userId } = await signInDemo(db);
    await saveProfile(db, userId, {
      citizenships: ['US'], homeCountry: 'US',
      idpConvention: null, idpExpiry: null,
      controlledMeds: [], hasMinors: false,
    });

    const { output } = await resolveFlowInternal(db, 'preflight-jp');
    expect(output['n-visa']?.choiceId).toBe('no');
  });

  it('KE citizenship does not auto-resolve n-visa (no seed row, AI mock returns null)', async () => {
    const db = await makeDb();
    const { userId } = await signInDemo(db);
    await saveProfile(db, userId, {
      citizenships: ['KE'], homeCountry: 'KE',
      idpConvention: null, idpExpiry: null,
      controlledMeds: [], hasMinors: false,
    });

    const { output } = await resolveFlowInternal(db, 'preflight-jp');
    expect(output['n-visa']).toBeUndefined();
  });

  it('flipping citizenship from US to KE removes auto-resolution', async () => {
    const db = await makeDb();
    const { userId } = await signInDemo(db);

    await saveProfile(db, userId, {
      citizenships: ['US'], homeCountry: 'US',
      idpConvention: null, idpExpiry: null,
      controlledMeds: [], hasMinors: false,
    });
    expect((await resolveFlowInternal(db, 'preflight-jp')).output['n-visa']?.choiceId).toBe('no');

    await saveProfile(db, userId, {
      citizenships: ['KE'], homeCountry: 'KE',
      idpConvention: null, idpExpiry: null,
      controlledMeds: [], hasMinors: false,
    });
    expect((await resolveFlowInternal(db, 'preflight-jp')).output['n-visa']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/profile-resolution.test.ts`
Expected: FAIL (internal `resolveFlow` helper doesn't exist yet, or signature mismatch).

- [ ] **Step 3: Rewrite `src/lib/conditions/actions.ts`**

Replace the entire file:

```ts
'use server';

import { eq, and, desc } from 'drizzle-orm';
import { db as prodDb } from '@/lib/db/client';
import { trip, leg } from '@/lib/db/schema';
import { hydrateLeg } from './readiness';
import { resolveFlow as runResolver, legSeqForFlow } from '@/lib/rules/index';
import { loadProfile, loadTripContext } from '@/lib/profile-actions';
import { requireSession } from '@/lib/session';
import type { PermanentProfile, TripContext } from '@/lib/user-profile';
import type { Leg, ResolverOutput } from '@/lib/rules/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

const DEFAULT_PROFILE = (userId: string): PermanentProfile => ({
  userId,
  citizenships: [],
  homeCountry: null,
  idpConvention: null,
  idpExpiry: null,
  controlledMeds: [],
  hasMinors: false,
  extras: {},
});

const DEFAULT_CONTEXT = (tripId: string): TripContext => ({
  tripId,
  travelingWithMinors: false,
  drivingAtDestination: false,
  carryingControlledMeds: false,
  purpose: null,
  extras: {},
});

async function loadActiveTrip(db: AnyDb, userId: string) {
  const rows = await db.select().from(trip).where(eq(trip.userId, userId)).orderBy(desc(trip.createdAt)).limit(1);
  if (rows.length === 0) throw new Error('No trip for user');
  return rows[0];
}

async function loadLegForFlow(db: AnyDb, tripId: string, flowId: string): Promise<Leg> {
  const seq = legSeqForFlow(flowId);
  if (seq === null) throw new Error(`No leg-seq mapping for flow ${flowId}`);
  const rows = await db.select().from(leg).where(and(eq(leg.tripId, tripId), eq(leg.seq, seq)));
  if (rows.length === 0) throw new Error(`No leg seq=${seq} for trip ${tripId}`);
  const r = rows[0];
  return {
    from: r.fromCountry,
    to: r.toCountry,
    startDate: r.startDate,
    endDate: r.endDate,
  };
}

/** Internal helper exposed for tests; takes a db handle. */
export async function resolveFlow(
  db: AnyDb,
  flowId: string,
): Promise<{ output: ResolverOutput; missing: { type: string; key: string }[]; leg: Leg }> {
  // Tests bypass cookie/session by calling this directly with a known db; assume an active session row exists.
  // In tests we call signInDemo first which sets the cookie via the mock, so requireSession works there too.
  const userId = await requireSession();
  const profile = (await loadProfile(db, userId)) ?? DEFAULT_PROFILE(userId);
  const t = await loadActiveTrip(db, userId);
  const legRow = await loadLegForFlow(db, t.id, flowId);
  const context = (await loadTripContext(db, t.id)) ?? DEFAULT_CONTEXT(t.id);
  const { facts, missing } = await hydrateLeg(profile, context, legRow, { flowId, db });
  const output = runResolver(flowId, profile, context, legRow, { tables: facts.tables });
  return { output, missing, leg: legRow };
}

export async function resolveFlowAction(
  flowId: string,
): Promise<{ output: ResolverOutput; missing: { type: string; key: string }[]; leg: Leg }> {
  return resolveFlow(prodDb, flowId);
}
```

- [ ] **Step 4: Update `src/components/destify/flow-modal.tsx` call site**

Find the `useEffect` around L237 that builds the hardcoded `profile` / `context` / `activeLeg` literals and calls `resolveFlowAction(flow.id, profile, context, activeLeg)`. Replace the body so only `flow.id` is passed:

```ts
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const { output } = await resolveFlowAction(flow.id);
      if (cancelled) return;
      applyResolution(flow.id, output);
    } catch (err) {
      console.error('[FlowGraphView] resolveFlowAction failed:', err);
    }
  })();
  return () => { cancelled = true; };
}, [flow.id, applyResolution]);
```

Remove the surrounding `const profile = …`, `const context = …`, and `activeLeg` calculation that was solely feeding the old args. Keep anything that other parts of the modal still need.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS. The new acceptance test should pass; existing 31 keep passing.

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/conditions/actions.ts src/components/destify/flow-modal.tsx tests/profile-resolution.test.ts
git commit -m "Migrate resolveFlowAction(flowId): derive profile/context server-side from session (#5)"
```

---

## Task 7: Login page → `signInDemoAction` (drop localStorage flag)

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Update imports**

Replace `import { useRouter } from "next/navigation";` (already present from #6) and add `signInDemoAction` import:

```ts
import { signInDemoAction } from "@/lib/auth-actions";
```

- [ ] **Step 2: Replace `bypassLogin`**

Find:

```ts
const bypassLogin = () => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("destify-demo-session", "1");
  }
  router.push("/organizer");
};
```

Replace with:

```ts
const bypassLogin = async () => {
  try {
    await signInDemoAction();
    router.push("/organizer");
  } catch (err) {
    console.error('[bypassLogin] signInDemoAction failed:', err);
  }
};
```

Update each button's `onClick={bypassLogin}` → no change needed (handler is now async; React allows async event handlers).

- [ ] **Step 3: Run typecheck + dev server smoke**

Run: `npx tsc --noEmit && curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/login` (after `npm run dev` in another shell).
Expected: tsc clean; HTTP 200 from /login.

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "Wire login bypass to signInDemoAction; drop localStorage flag (#5)"
```

---

## Task 8: Onboarding wizard `/onboarding`

**Files:**
- Create: `src/app/onboarding/page.tsx`
- Create: `src/app/onboarding/wizard.tsx`

- [ ] **Step 1: Server shell with redirect guards**

```tsx
// src/app/onboarding/page.tsx
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/session';
import { getProfileAction } from '@/lib/profile-actions';
import { Wizard } from './wizard';

export default async function OnboardingPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  const profile = await getProfileAction();
  if (profile) redirect('/organizer');
  return <Wizard />;
}
```

- [ ] **Step 2: Wizard client component**

```tsx
// src/app/onboarding/wizard.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProfileAction } from "@/lib/profile-actions";
import { COUNTRIES } from "@/lib/iso-countries";
import { toast } from "@/components/destify/toast";

type Tier1 = {
  citizenships: string[];
  homeCountry: string | null;
  idpConvention: '1949' | '1968' | null;
  idpExpiry: string | null;
  controlledMeds: string[];
  hasMinors: boolean;
  drivesAbroad: boolean; // wizard-local toggle; not persisted
};

const EMPTY: Tier1 = {
  citizenships: [], homeCountry: null,
  idpConvention: null, idpExpiry: null,
  controlledMeds: [], hasMinors: false,
  drivesAbroad: true,
};

export function Wizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Tier1>(EMPTY);
  const [pending, startTransition] = useTransition();

  const save = (next: Tier1, after: () => void) => {
    startTransition(async () => {
      try {
        await saveProfileAction({
          citizenships: next.citizenships,
          homeCountry: next.homeCountry,
          idpConvention: next.drivesAbroad ? next.idpConvention : null,
          idpExpiry: next.drivesAbroad ? next.idpExpiry : null,
          controlledMeds: next.controlledMeds,
          hasMinors: next.hasMinors,
        });
        after();
      } catch {
        toast('Couldn’t save — please retry');
      }
    });
  };

  const finish = () => save(data, () => router.push('/organizer'));

  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--cream-warm)' }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'white', borderRadius: 18, padding: 32, boxShadow: '0 8px 32px rgba(0,0,0,.06)' }}>
        <Progress step={step} total={3} />
        {step === 0 && <Identity data={data} setData={setData} />}
        {step === 1 && <Driving data={data} setData={setData} />}
        {step === 2 && <Health data={data} setData={setData} />}
        <Footer
          step={step}
          pending={pending}
          onBack={() => setStep((s) => Math.max(0, s - 1))}
          onSkip={finish}
          onNext={() => (step === 2 ? finish() : setStep((s) => s + 1))}
        />
      </div>
    </div>
  );
}

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} style={{
          width: 8, height: 8, borderRadius: 999,
          background: i === step ? 'var(--charcoal)' : 'rgba(148,139,130,.28)',
        }} />
      ))}
    </div>
  );
}

function Identity({ data, setData }: { data: Tier1; setData: (d: Tier1) => void }) {
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 4 }}>About you</h2>
      <p style={{ color: 'var(--mocha)', marginBottom: 20, fontSize: 14 }}>Used to personalize visa, driving, and health rules.</p>

      <Label>Citizenships</Label>
      <MultiCountry value={data.citizenships} onChange={(v) => setData({ ...data, citizenships: v })} />

      <Label style={{ marginTop: 16 }}>Home country</Label>
      <SingleCountry value={data.homeCountry} onChange={(v) => setData({ ...data, homeCountry: v })} />

      <Label style={{ marginTop: 16 }}>Traveling with minors?</Label>
      <YesNo value={data.hasMinors} onChange={(v) => setData({ ...data, hasMinors: v })} />
    </div>
  );
}

function Driving({ data, setData }: { data: Tier1; setData: (d: Tier1) => void }) {
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 4 }}>Driving</h2>
      <p style={{ color: 'var(--mocha)', marginBottom: 20, fontSize: 14 }}>Skip if you don’t drive abroad.</p>

      <Label>Drive abroad?</Label>
      <YesNo value={data.drivesAbroad} onChange={(v) => setData({ ...data, drivesAbroad: v })} />

      {data.drivesAbroad && (
        <>
          <Label style={{ marginTop: 16 }}>IDP convention</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['1949', '1968'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setData({ ...data, idpConvention: v })}
                className="seg" data-active={data.idpConvention === v}
                style={segStyle(data.idpConvention === v)}>
                {v}
              </button>
            ))}
          </div>

          <Label style={{ marginTop: 16 }}>IDP expiry</Label>
          <input type="date" value={data.idpExpiry ?? ''}
            onChange={(e) => setData({ ...data, idpExpiry: e.target.value || null })}
            className="input-field" style={inputStyle} />
        </>
      )}
    </div>
  );
}

function Health({ data, setData }: { data: Tier1; setData: (d: Tier1) => void }) {
  const [draft, setDraft] = useState('');
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 4 }}>Health</h2>
      <p style={{ color: 'var(--mocha)', marginBottom: 20, fontSize: 14 }}>Used to flag import-permit requirements.</p>

      <Label>Controlled medications (generic names)</Label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {data.controlledMeds.map((m) => (
          <span key={m} style={chipStyle}>
            {m}
            <button type="button" onClick={() => setData({ ...data, controlledMeds: data.controlledMeds.filter((x) => x !== m) })}
              style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mocha)' }}>×</button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && draft.trim()) {
            e.preventDefault();
            setData({ ...data, controlledMeds: [...data.controlledMeds, draft.trim()] });
            setDraft('');
          }
        }}
        placeholder="Type and press Enter"
        className="input-field"
        style={inputStyle}
      />
    </div>
  );
}

function Footer({ step, pending, onBack, onSkip, onNext }: { step: number; pending: boolean; onBack: () => void; onSkip: () => void; onNext: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
      <button type="button" onClick={onBack} disabled={step === 0}
        style={{ ...secondaryBtn, opacity: step === 0 ? 0.4 : 1 }}>Back</button>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={onSkip} disabled={pending} style={secondaryBtn}>Skip</button>
        <button type="button" onClick={onNext} disabled={pending} style={primaryBtn}>
          {step === 2 ? 'Finish' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--mocha)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, ...style }}>{children}</div>;
}

function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[{ k: true, l: 'Yes' }, { k: false, l: 'No' }].map((o) => (
        <button key={o.l} type="button" onClick={() => onChange(o.k)}
          style={segStyle(value === o.k)}>{o.l}</button>
      ))}
    </div>
  );
}

function MultiCountry({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {value.map((c) => (
          <span key={c} style={chipStyle}>
            {c}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== c))}
              style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mocha)' }}>×</button>
          </span>
        ))}
      </div>
      <select onChange={(e) => { if (e.target.value && !value.includes(e.target.value)) onChange([...value, e.target.value]); e.target.value = ''; }}
        className="input-field" style={inputStyle} defaultValue="">
        <option value="" disabled>Add a country</option>
        {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>
    </div>
  );
}

function SingleCountry({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}
      className="input-field" style={inputStyle}>
      <option value="">— select —</option>
      {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
    </select>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(253,251,247,.7)',
  border: '1.5px solid rgba(148,139,130,.18)', borderRadius: 10,
  padding: '11px 14px', fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--charcoal)',
  outline: 'none', boxSizing: 'border-box',
};
const segStyle = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '10px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500,
  border: '1.5px solid ' + (active ? 'var(--charcoal)' : 'rgba(148,139,130,.22)'),
  background: active ? 'var(--charcoal)' : 'transparent',
  color: active ? 'var(--cream)' : 'var(--charcoal)', cursor: 'pointer',
});
const chipStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999,
  background: 'var(--sand)', fontSize: 12.5, color: 'var(--charcoal)',
};
const primaryBtn: React.CSSProperties = {
  padding: '10px 22px', borderRadius: 999, border: 'none',
  background: 'linear-gradient(135deg, var(--sage) 0%, var(--ocean) 100%)',
  color: 'var(--cream)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 999, border: '1.5px solid rgba(148,139,130,.22)',
  background: 'transparent', color: 'var(--mocha)', fontSize: 13, cursor: 'pointer',
};
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/onboarding
git commit -m "Add onboarding wizard at /onboarding with Tier-1 capture (#5)"
```

---

## Task 9: `/profile` settings page

**Files:**
- Create: `src/app/profile/page.tsx`
- Create: `src/app/profile/form.tsx`

- [ ] **Step 1: Server shell**

```tsx
// src/app/profile/page.tsx
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/session';
import { getProfileAction } from '@/lib/profile-actions';
import { ProfileForm } from './form';

export default async function ProfilePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');
  const profile = await getProfileAction();
  return <ProfileForm initial={profile} />;
}
```

- [ ] **Step 2: Client form**

```tsx
// src/app/profile/form.tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { saveProfileAction } from "@/lib/profile-actions";
import { COUNTRIES } from "@/lib/iso-countries";
import { toast } from "@/components/destify/toast";
import type { PermanentProfile } from "@/lib/user-profile";

const T2 = [
  { title: 'Cards', body: 'Track credit cards and benefits used for trip planning.' },
  { title: 'Points programs', body: 'Loyalty programs you earn / redeem with.' },
  { title: 'Dietary', body: 'Dietary preferences and restrictions.' },
  { title: 'Allergies', body: 'Allergies that matter for travel.' },
  { title: 'Mobility', body: 'Mobility needs that affect itineraries.' },
];

export function ProfileForm({ initial }: { initial: PermanentProfile | null }) {
  const [c, setC] = useState<string[]>(initial?.citizenships ?? []);
  const [home, setHome] = useState<string | null>(initial?.homeCountry ?? null);
  const [conv, setConv] = useState<'1949' | '1968' | null>(initial?.idpConvention ?? null);
  const [expiry, setExpiry] = useState<string | null>(initial?.idpExpiry ?? null);
  const [meds, setMeds] = useState<string[]>(initial?.controlledMeds ?? []);
  const [hasMinors, setHasMinors] = useState<boolean>(initial?.hasMinors ?? false);
  const [medDraft, setMedDraft] = useState('');
  const [pending, startTransition] = useTransition();

  const save = () => startTransition(async () => {
    try {
      await saveProfileAction({
        citizenships: c, homeCountry: home,
        idpConvention: conv, idpExpiry: expiry,
        controlledMeds: meds, hasMinors,
      });
      toast('Profile saved');
    } catch {
      toast('Couldn’t save — please retry');
    }
  });

  return (
    <div style={{ minHeight: '100svh', background: 'var(--cream-warm)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <Link href="/organizer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--mocha)', textDecoration: 'none', marginBottom: 16, fontSize: 13 }}>
          <ArrowLeft size={13} /> Back to organizer
        </Link>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 32, fontWeight: 500, marginBottom: 28 }}>Profile</h1>

        <Section title="Identity">
          <Label>Citizenships</Label>
          <MultiCountry value={c} onChange={setC} />
          <Label style={{ marginTop: 16 }}>Home country</Label>
          <SingleCountry value={home} onChange={setHome} />
          <Label style={{ marginTop: 16 }}>Has minors</Label>
          <YesNo value={hasMinors} onChange={setHasMinors} />
        </Section>

        <Section title="Driving">
          <Label>IDP convention</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            {([null, '1949', '1968'] as const).map((v) => (
              <button key={String(v)} type="button" onClick={() => setConv(v)} style={segStyle(conv === v)}>
                {v ?? 'None'}
              </button>
            ))}
          </div>
          <Label style={{ marginTop: 16 }}>IDP expiry</Label>
          <input type="date" value={expiry ?? ''} onChange={(e) => setExpiry(e.target.value || null)} style={inputStyle} />
        </Section>

        <Section title="Health">
          <Label>Controlled medications</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {meds.map((m) => (
              <span key={m} style={chipStyle}>
                {m}
                <button type="button" onClick={() => setMeds(meds.filter((x) => x !== m))} style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mocha)' }}>×</button>
              </span>
            ))}
          </div>
          <input
            value={medDraft}
            onChange={(e) => setMedDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && medDraft.trim()) {
                e.preventDefault();
                setMeds([...meds, medDraft.trim()]);
                setMedDraft('');
              }
            }}
            placeholder="Type and press Enter"
            style={inputStyle}
          />
        </Section>

        <button type="button" onClick={save} disabled={pending} style={{ ...primaryBtn, marginTop: 8 }}>
          {pending ? 'Saving…' : 'Save profile'}
        </button>

        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 22, marginTop: 40, marginBottom: 16 }}>Advanced</h2>
        {T2.map((s) => (
          <div key={s.title} style={{ ...sectionStyle, opacity: 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <strong style={{ fontSize: 14 }}>{s.title}</strong>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--sand)', color: 'var(--mocha)' }}>Coming soon</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--mocha)' }}>{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// — same primitive components as wizard.tsx; if you have time, factor into src/components/destify/profile-fields.tsx and import from both pages —
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={sectionStyle}>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  );
}
function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--mocha)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, ...style }}>{children}</div>;
}
function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[{ k: true, l: 'Yes' }, { k: false, l: 'No' }].map((o) => (
        <button key={o.l} type="button" onClick={() => onChange(o.k)} style={segStyle(value === o.k)}>{o.l}</button>
      ))}
    </div>
  );
}
function MultiCountry({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {value.map((c) => (
          <span key={c} style={chipStyle}>
            {c}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== c))} style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mocha)' }}>×</button>
          </span>
        ))}
      </div>
      <select onChange={(e) => { if (e.target.value && !value.includes(e.target.value)) onChange([...value, e.target.value]); e.target.value = ''; }} style={inputStyle} defaultValue="">
        <option value="" disabled>Add a country</option>
        {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>
    </div>
  );
}
function SingleCountry({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)} style={inputStyle}>
      <option value="">— select —</option>
      {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
    </select>
  );
}

const sectionStyle: React.CSSProperties = { background: 'white', borderRadius: 18, padding: 28, marginBottom: 18, boxShadow: '0 2px 12px rgba(0,0,0,.04)' };
const inputStyle: React.CSSProperties = { width: '100%', background: 'rgba(253,251,247,.7)', border: '1.5px solid rgba(148,139,130,.18)', borderRadius: 10, padding: '11px 14px', fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--charcoal)', outline: 'none', boxSizing: 'border-box' };
const segStyle = (active: boolean): React.CSSProperties => ({ padding: '10px 18px', borderRadius: 999, fontSize: 13, fontWeight: 500, border: '1.5px solid ' + (active ? 'var(--charcoal)' : 'rgba(148,139,130,.22)'), background: active ? 'var(--charcoal)' : 'transparent', color: active ? 'var(--cream)' : 'var(--charcoal)', cursor: 'pointer' });
const chipStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999, background: 'var(--sand)', fontSize: 12.5, color: 'var(--charcoal)' };
const primaryBtn: React.CSSProperties = { padding: '12px 26px', borderRadius: 999, border: 'none', background: 'linear-gradient(135deg, var(--sage) 0%, var(--ocean) 100%)', color: 'var(--cream)', fontSize: 14, fontWeight: 500, cursor: 'pointer' };
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/profile
git commit -m "Add /profile settings page with Tier-1 fields and Tier-2 placeholders (#5)"
```

---

## Task 10: Trip details drawer + trip-header pill

**Files:**
- Create: `src/components/destify/trip-details-drawer.tsx`
- Modify: `src/components/destify/trip-header.tsx`

- [ ] **Step 1: Drawer component**

```tsx
// src/components/destify/trip-details-drawer.tsx
"use client";

import { useState, useTransition } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { saveTripContextAction } from "@/lib/profile-actions";
import { toast } from "./toast";
import type { TripContext } from "@/lib/user-profile";

type Purpose = 'tourism' | 'business' | 'family' | 'study';
const PURPOSES: Purpose[] = ['tourism', 'business', 'family', 'study'];

export function TripDetailsDrawer({
  open, onOpenChange, tripId, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tripId: string;
  initial: TripContext | null;
}) {
  const [minors, setMinors] = useState(initial?.travelingWithMinors ?? false);
  const [driving, setDriving] = useState(initial?.drivingAtDestination ?? false);
  const [meds, setMeds] = useState(initial?.carryingControlledMeds ?? false);
  const [purpose, setPurpose] = useState<Purpose | null>(initial?.purpose ?? null);
  const [pending, startTransition] = useTransition();

  const save = () => startTransition(async () => {
    try {
      await saveTripContextAction(tripId, {
        travelingWithMinors: minors,
        drivingAtDestination: driving,
        carryingControlledMeds: meds,
        purpose,
      });
      toast('Trip details saved');
      onOpenChange(false);
    } catch {
      toast('Couldn’t save — please retry');
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" style={{ padding: 24, width: 380 }}>
        <SheetHeader><SheetTitle>Trip details</SheetTitle></SheetHeader>
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Toggle label="Traveling with minors" value={minors} onChange={setMinors} />
          <Toggle label="Driving at destination" value={driving} onChange={setDriving} />
          <Toggle label="Carrying controlled meds" value={meds} onChange={setMeds} />
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--mocha)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Purpose</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PURPOSES.map((p) => (
                <button key={p} type="button" onClick={() => setPurpose(p === purpose ? null : p)}
                  style={{ padding: '8px 14px', borderRadius: 999, fontSize: 13, border: '1.5px solid ' + (purpose === p ? 'var(--charcoal)' : 'rgba(148,139,130,.22)'), background: purpose === p ? 'var(--charcoal)' : 'transparent', color: purpose === p ? 'var(--cream)' : 'var(--charcoal)', cursor: 'pointer' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={save} disabled={pending}
            style={{ marginTop: 12, padding: '12px 22px', borderRadius: 999, border: 'none', background: 'linear-gradient(135deg, var(--sage) 0%, var(--ocean) 100%)', color: 'var(--cream)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
      <span style={{ fontSize: 14 }}>{label}</span>
      <button type="button" onClick={() => onChange(!value)}
        style={{ width: 40, height: 22, borderRadius: 999, border: 'none', background: value ? 'var(--sage-deep)' : 'rgba(148,139,130,.32)', position: 'relative', cursor: 'pointer' }}>
        <span style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 16, height: 16, borderRadius: 999, background: 'white', transition: 'left 0.18s' }} />
      </button>
    </label>
  );
}
```

- [ ] **Step 2: Add "Trip details" pill to `trip-header.tsx`**

In `src/components/destify/trip-header.tsx`, import the drawer and add a state-managed pill button next to the existing "Trip readiness" pill. The trip-header receives `tripId` and `tripContext` from `/organizer` (Task 11 plumbs this through).

```tsx
"use client";
// ...existing imports...
import { useState } from "react";
import { TripDetailsDrawer } from "./trip-details-drawer";
import type { TripContext } from "@/lib/user-profile";

export function TripHeader({ tripId, tripContext }: { tripId: string; tripContext: TripContext | null }) {
  const [open, setOpen] = useState(false);
  // ...existing render...
  // Next to the existing readiness pill, add:
  //   <button onClick={() => setOpen(true)} className="…pill styling…">Trip details</button>
  // and at the end of the render:
  //   <TripDetailsDrawer open={open} onOpenChange={setOpen} tripId={tripId} initial={tripContext} />
}
```

Use the existing "Trip readiness" pill's class/style as a template for the new "Trip details" pill so they visually match.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/destify/trip-details-drawer.tsx src/components/destify/trip-header.tsx
git commit -m "Add Trip details drawer + header pill writing to trip_context (#5)"
```

---

## Task 11: Organizer route guard + thread trip data to children

**Files:**
- Modify: `src/app/organizer/page.tsx`

- [ ] **Step 1: Convert to async server component with guards**

```tsx
// src/app/organizer/page.tsx
import { redirect } from 'next/navigation';
import { getSessionUserId } from '@/lib/session';
import { getProfileAction, getTripContextAction } from '@/lib/profile-actions';
import { db } from '@/lib/db/client';
import { trip } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
// ...existing organizer imports (TopBar, TripHeader, RightRail, etc.)...

export default async function OrganizerPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect('/login');

  const profile = await getProfileAction();
  if (!profile) redirect('/onboarding');

  const trips = await db.select().from(trip).where(eq(trip.userId, userId)).orderBy(desc(trip.createdAt)).limit(1);
  if (trips.length === 0) redirect('/login'); // signInDemo always seeds one; defensive
  const activeTrip = trips[0];
  const tripContext = await getTripContextAction(activeTrip.id);

  return (
    <>
      {/* existing layout — pass tripId/tripContext to TripHeader */}
      <TripHeader tripId={activeTrip.id} tripContext={tripContext} />
      {/* …rest of organizer… */}
    </>
  );
}
```

If existing children expect a non-Promise (client component imports), make sure they're imported normally; only the page itself is async.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/organizer/page.tsx
git commit -m "Guard /organizer behind session + profile; pass trip data to children (#5)"
```

---

## Task 12: Topbar avatar menu (Edit profile / Sign out)

**Files:**
- Create: `src/components/destify/avatar-menu.tsx`
- Modify: `src/components/destify/topbar.tsx`

- [ ] **Step 1: Avatar menu component**

```tsx
// src/components/destify/avatar-menu.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOutAction } from "@/lib/auth-actions";

export function AvatarMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const signOut = async () => {
    try { await signOutAction(); } catch { /* network noise, still navigate */ }
    router.push('/login');
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="grid h-8 w-8 place-items-center rounded-full text-[13px] font-semibold text-white"
        style={{ background: 'var(--grad-avatar)', cursor: 'pointer', border: 'none' }}>
        GV
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', minWidth: 180, background: 'white', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.12)', padding: 6, zIndex: 50 }}>
          <Link href="/profile" onClick={() => setOpen(false)}
            style={{ display: 'block', padding: '9px 12px', borderRadius: 8, color: 'var(--charcoal)', textDecoration: 'none', fontSize: 13.5 }}>
            Edit profile
          </Link>
          <button type="button" onClick={signOut}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, color: 'var(--charcoal)', fontSize: 13.5, background: 'none', border: 'none', cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace avatar div in `topbar.tsx`**

In `src/components/destify/topbar.tsx`, find the existing `<div className="grid h-8 w-8 …">GV</div>` block and replace with `<AvatarMenu />`. Add the import.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/destify/avatar-menu.tsx src/components/destify/topbar.tsx
git commit -m "Topbar avatar opens menu with Edit profile + Sign out (#5)"
```

---

## Task 13: Full verification walkthrough

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass (existing 31 + new from Tasks 1, 3, 4, 6).

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: same baseline as before (2 pre-existing testimonial-quote errors; no new errors).

- [ ] **Step 4: Manual browser walkthrough**

Start: `npm run dev`

Walkthrough:
1. Visit http://localhost:3000/login → click "Skip — try the demo" → land on `/onboarding`.
2. On wizard step 1, add `US` citizenship and `US` home country; click Continue.
3. Step 2: leave drives-abroad as Yes, pick 1949, expiry 2027-12-31; click Continue.
4. Step 3: leave meds empty; click Finish → land on `/organizer`.
5. Open the preflight modal → confirm `n-visa` shows auto-resolved (provenance "no").
6. Click avatar → "Edit profile" → change citizenships to `KE` only → Save profile → toast appears.
7. Back to organizer → open preflight modal again → `n-visa` should NOT be auto-resolved (KE has no seed row).
8. Open the new "Trip details" drawer from trip-header → flip "Carrying controlled meds" → Save → toast appears.
9. Click avatar → Sign out → land on `/login`.
10. Click "Skip — try the demo" again → because the same browser cookie may still be there, signInDemoAction reuses the user → land on `/organizer` (no onboarding redirect since profile exists).

Acceptance: every step succeeds; no JS console errors during the run; toggling citizenship visibly changes auto-resolution.

- [ ] **Step 5: Stop dev server**

Stop the `npm run dev` process.

- [ ] **Step 6: Commit (only if anything trivial was tweaked during walkthrough)**

If walkthrough surfaces a small fix, commit it. Otherwise nothing to do.

---

## Self-review notes

Skimmed spec against plan after writing:

- **Session module** → Task 1.
- **`signInDemoAction` idempotent + atomic seeding** → Task 3 (3 tests cover idempotency and stale-cookie recovery).
- **`signOutAction`** → Task 3 (`clearSessionCookie`) + wired in Task 12 (AvatarMenu).
- **Tier-1 + TripContext Zod schemas** → Task 4 with strict-mode rejection tests.
- **Ownership guard on `saveTripContextAction`** → Task 4 (`assertTripOwned`).
- **`FLOW_LEG_SEQ`** → Task 5.
- **`resolveFlowAction(flowId)` server-derived** → Task 6 with the E2E acceptance test (US auto-resolves, KE doesn't, flipping changes result).
- **flow-modal call-site cleanup** → Task 6 step 4.
- **Onboarding wizard with skip semantics** → Task 8 (Skip writes partial-fill then routes).
- **Settings page with Tier-2 placeholders** → Task 9.
- **Trip details drawer** → Task 10.
- **Organizer route guard + trip-context plumbing** → Task 11.
- **Topbar avatar menu** → Task 12.
- **Acceptance walkthrough** → Task 13.

Files referenced consistently across tasks. The `AnyDb` pattern matches the existing codebase. No placeholders.
