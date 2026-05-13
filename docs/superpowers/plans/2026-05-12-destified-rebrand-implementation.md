# Destified rebrand + intro animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand product Destify → Destified, add a skip handler for the landing-page intro, and rebuild the intro as a letter-level layout transition via Motion so the final wordmark assembles from "Destinations, simplified."

**Architecture:** Mostly mechanical text + folder rename for Part 1. Skip handler is a small `useEffect` addition. The new animation introduces `motion` (the package, formerly `framer-motion`) and replaces the hero's phases 1–3 JSX with per-letter `<motion.span layout>` inside a `<LayoutGroup>`. Survivor letters carry stable keys through stack → row → wordmark transitions; dropped letters fade and collapse via `<AnimatePresence>`. The "ified" survivors color-tween terracotta → sage-deep during the final transition.

**Tech Stack:** Next.js 16 App Router (Turbopack), React, `motion@^11` (new dependency), TypeScript. No test framework changes.

**Spec:** [`docs/superpowers/specs/2026-05-12-destified-rebrand-design.md`](../specs/2026-05-12-destified-rebrand-design.md)

**Related issues:** Fixes #19.

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| `package.json` | Modify | `name`: `destify` → `destified`; add `motion` dependency. |
| `README.md` | Modify | All prose "Destify" → "Destified"; ASCII tree updated. |
| `src/components/destify/` | Rename | → `src/components/destified/` (10 files inside, content unchanged for non-toast imports). |
| `src/components/destified/topbar.tsx` | Modify | Wordmark `Dest<span>ify</span>` → `Dest<span>ified</span>`; update internal `@/components/destify/toast` import. |
| `src/components/destified/right-rail.tsx` | Modify | Update internal `@/components/destify/toast` import. |
| `src/app/layout.tsx` | Modify | Update `Toaster` import path; page `title` → `"Destified — plan trips, slowly."` |
| `src/app/organizer/page.tsx` | Modify | Update 6 `@/components/destify/*` imports. |
| `src/app/login/page.tsx` | Modify | Update `toast` import; `alt="Destify"` → `alt="Destified"`; testimonial quote; mobile wordmark span. |
| `src/app/onboarding/wizard.tsx` | Modify | Update `toast` import. |
| `src/app/profile/form.tsx` | Modify | Update `toast` import. |
| `src/app/globals.css` | Modify | Comment headers `Destify palette` → `Destified palette` (5 comment lines). |
| `src/lib/trip-data.ts` | Modify | File header comment "Destify organizer" → "Destified organizer". |
| `src/app/page.tsx` | Modify | Three concerns: nav wordmark line 143 (Task 3), skip handler in intro `useEffect` (Task 4), and the entire hero animation block including phases 1–3 JSX, keyframes, and the pulse ring (Task 5). StepRow body copy line 614 ("Destify plots your route") also renames in Task 3. |

**Stays as-is (internal identifiers per spec):**
- `src/lib/session.ts:4` — `SESSION_COOKIE = 'destify-session'`
- `src/lib/auth-actions.ts:41` — `demo-${shortId()}@destify.local`
- `tests/auth-actions.test.ts:36` — asserts `'destify-session'` cookie (matches the unchanged constant)
- All CSS variable names (`--font-serif`, `--sage-deep`, etc.)
- `docs/superpowers/specs/*` and `docs/superpowers/plans/*` — historical artifacts
- `docs/design-system-sync.md` — historical artifact

---

## Task 1: Install motion package

**Files:**
- Modify: `package.json` (auto, via npm install)
- Modify: `package-lock.json` (auto)

- [ ] **Step 1: Install motion**

Run: `npm install motion`
Expected: `motion@^11.x.x` (or newer) added to `dependencies`. No peer warnings except React-version informational notes.

- [ ] **Step 2: Verify the install**

Run: `node -e "console.log(require('motion/package.json').version)"`
Expected: prints the installed version (e.g. `11.x.x`). Confirms the package resolves.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add motion dependency for intro animation rework (#19)"
```

---

## Task 2: Rename folder src/components/destify/ → destified/ and update imports

**Files:**
- Rename: `src/components/destify/` → `src/components/destified/` (10 inner files unchanged in content for this step except the two self-imports below)
- Modify (import paths only): `src/app/layout.tsx`, `src/app/organizer/page.tsx`, `src/app/login/page.tsx`, `src/app/onboarding/wizard.tsx`, `src/app/profile/form.tsx`, `src/components/destified/topbar.tsx`, `src/components/destified/right-rail.tsx`

- [ ] **Step 1: Move the folder via git**

Run: `git mv src/components/destify src/components/destified`
Expected: 10 files moved (avatar-menu.tsx, flow-modal.tsx, right-rail.tsx, route-map-inner.tsx, route-map.tsx, timeline-panel.tsx, toast.tsx, topbar.tsx, trip-details-drawer.tsx, trip-header.tsx). `git status` shows them as renames.

- [ ] **Step 2: Update all `@/components/destify/` imports**

Use a sed-style sweep over the call sites. Files to update (verified by grep):

```
src/app/layout.tsx
src/app/organizer/page.tsx
src/app/login/page.tsx
src/app/onboarding/wizard.tsx
src/app/profile/form.tsx
src/components/destified/topbar.tsx
src/components/destified/right-rail.tsx
```

For each file, replace every occurrence of `@/components/destify/` with `@/components/destified/`. The total is ~12 import lines.

Sample edits:

`src/app/layout.tsx` — line 4:
```ts
// before
import { Toaster } from "@/components/destify/toast";
// after
import { Toaster } from "@/components/destified/toast";
```

`src/app/organizer/page.tsx` — lines 3–8 (6 imports):
```ts
import { TopBar } from "@/components/destified/topbar";
import { TripHeader } from "@/components/destified/trip-header";
import { TimelinePanel } from "@/components/destified/timeline-panel";
import { RouteMap } from "@/components/destified/route-map";
import { RightRail } from "@/components/destified/right-rail";
import { FlowModal } from "@/components/destified/flow-modal";
```

`src/components/destified/topbar.tsx` — line 4:
```ts
import { toast } from "@/components/destified/toast";
```

`src/components/destified/right-rail.tsx` — line 5:
```ts
import { toast } from "@/components/destified/toast";
```

`src/app/login/page.tsx`, `src/app/onboarding/wizard.tsx`, `src/app/profile/form.tsx` — each has one toast import; update to the `destified/` path.

- [ ] **Step 3: Verify no `@/components/destify/` remains**

Run: `grep -rn "@/components/destify/" --include="*.ts" --include="*.tsx" .`
Expected: zero matches.

- [ ] **Step 4: TypeScript + test sanity check**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm test`
Expected: 70/70 tests pass (rename touches no logic).

- [ ] **Step 5: Commit**

```bash
git add src/components/destified/ src/app/layout.tsx src/app/organizer/page.tsx \
        src/app/login/page.tsx src/app/onboarding/wizard.tsx src/app/profile/form.tsx
git commit -m "Rename src/components/destify/ → destified/ and update imports (#19)

10 component files moved (content unchanged except 2 internal toast
imports). All call sites updated to @/components/destified/*."
```

---

## Task 3: Text renames — Destify → Destified (everywhere except the hero animation block)

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `src/app/layout.tsx` (page `title`)
- Modify: `src/app/login/page.tsx` (alt text, testimonial quote, mobile wordmark span)
- Modify: `src/app/page.tsx` (nav wordmark line 143, StepRow body line 614, leave the hero block untouched — that's Task 5)
- Modify: `src/components/destified/topbar.tsx` (wordmark span)
- Modify: `src/app/globals.css` (5 comment lines)
- Modify: `src/lib/trip-data.ts` (header comment)

- [ ] **Step 1: package.json name field**

In `package.json`, change the `name` field at the top:
```json
// before
"name": "destify",
// after
"name": "destified",
```

- [ ] **Step 2: README.md**

Replace every "Destify" with "Destified" in `README.md`. Verified locations: line 1 (`# Destify` → `# Destified`), line 8 (prose), line 38 (ASCII tree comment), line 41 (`destify/` → `destified/` in the tree). Run `grep -n "[Dd]estify" README.md` after editing to confirm zero matches.

- [ ] **Step 3: src/app/layout.tsx title**

Line 24:
```ts
// before
title: "Destify — plan trips, slowly.",
// after
title: "Destified — plan trips, slowly.",
```

- [ ] **Step 4: src/app/login/page.tsx — alt, quote, wordmark**

Line 235 (logo alt text):
```tsx
// before
<img src="/logo.png" alt="Destify" style={{ width: 32, height: 32, borderRadius: 9 }} />
// after
<img src="/logo.png" alt="Destified" style={{ width: 32, height: 32, borderRadius: 9 }} />
```

Line 294 (testimonial — replace the word "Destify" in the quote):
```tsx
// before
"Planning our honeymoon used to feel overwhelming — Destify made it feel like the adventure itself."
// after
"Planning our honeymoon used to feel overwhelming — Destified made it feel like the adventure itself."
```

Line 336 (mobile sans-style wordmark):
```tsx
// before
Dest<span style={{ color: "var(--sage-deep)" }}>ify</span>
// after
Dest<span style={{ color: "var(--sage-deep)" }}>ified</span>
```

- [ ] **Step 5: src/components/destified/topbar.tsx wordmark**

Line 36:
```tsx
// before
Dest<span style={{ color: "var(--sage-deep)" }}>ify</span>
// after
Dest<span style={{ color: "var(--sage-deep)" }}>ified</span>
```

- [ ] **Step 6: src/app/page.tsx — nav wordmark + StepRow body**

Line 143 (nav wordmark, italic em version):
```tsx
// before
Dest<em style={{ fontStyle: "italic", color: "var(--sage-deep)" }}>ify</em>
// after
Dest<em style={{ fontStyle: "italic", color: "var(--sage-deep)" }}>ified</em>
```

Line 614 (StepRow body copy):
```tsx
// before
<StepRow n="01" title="Add your destinations" body="Drop in where you're going. Destify plots your route and calculates distances automatically." />
// after
<StepRow n="01" title="Add your destinations" body="Drop in where you're going. Destified plots your route and calculates distances automatically." />
```

Do NOT touch lines 10, 91, 397, 416, 430, or 434 — those are part of the hero animation block that Task 5 replaces wholesale.

- [ ] **Step 7: src/app/globals.css — comment headers**

Replace the 5 occurrences of "Destify" in CSS comments:

Line 7: `/* ─── Destify palette + design tokens ──────── */` → `/* ─── Destified palette + design tokens ──────── */`
Line 53: `/* Destify earth-toned palette */` → `/* Destified earth-toned palette */`
Line 107: `/* Destify palette */` → `/* Destified palette */`
Line 216: `/* Tweak the default tooltip to match Destify's airy badge look. */` → `/* Tweak the default tooltip to match Destified's airy badge look. */`
Line 245: `/* Restyle the zoom +/− buttons to match Destify's cream-pill aesthetic */` → `/* Restyle the zoom +/− buttons to match Destified's cream-pill aesthetic */`

- [ ] **Step 8: src/lib/trip-data.ts header comment**

Line 1:
```ts
// before
// Demo trip data for the Destify organizer dashboard.
// after
// Demo trip data for the Destified organizer dashboard.
```

- [ ] **Step 9: Verify no unintended "Destify" survives**

Run: `grep -rn "Destify" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" --include="*.css" . 2>/dev/null | grep -v "node_modules\|package-lock\|docs/superpowers/\|docs/design-system-sync.md" | grep -v "src/app/page.tsx:10\|src/app/page.tsx:91\|src/app/page.tsx:397\|src/app/page.tsx:416\|src/app/page.tsx:430"`

Expected: zero matches outside the hero animation block. The hero animation block survives until Task 5 replaces it.

(Internal lowercase `destify` in `'destify-session'` cookie name and `@destify.local` email domain stays — per spec.)

- [ ] **Step 10: Build sanity check**

Run: `npm run build`
Expected: success. All 6 routes built.

- [ ] **Step 11: Commit**

```bash
git add package.json README.md src/app/layout.tsx src/app/login/page.tsx \
        src/components/destified/topbar.tsx src/app/page.tsx \
        src/app/globals.css src/lib/trip-data.ts
git commit -m "Rename user-visible Destify → Destified across copy, wordmarks, and comments (#19)

Page title, nav/topbar/login wordmarks, README, CSS palette headers,
and one trip-data comment. Hero animation block in page.tsx kept
intact for Task 5 (animation rework) to replace wholesale."
```

---

## Task 4: Skip handler for the intro animation

**Files:**
- Modify: `src/app/page.tsx` (intro `useEffect` starting at line ~79, plus hero container `onClick`, plus CTA `onClick` stops)

- [ ] **Step 1: Add skip logic to the intro useEffect**

Find the `useEffect` that schedules phase timers (around line 79 of `src/app/page.tsx`). Wrap the existing body so the cleanup function also removes the keydown listener, and add a `skip()` closure plus a keydown listener.

The existing body looks roughly like (current shape):
```tsx
useEffect(() => {
  const timers: ReturnType<typeof setTimeout>[] = [];
  // ... CITIES.forEach, etc.
  timers.push(setTimeout(() => setImgVisible(false), IMGS_END + 200));
  timers.push(setTimeout(() => setPhase(1), IMGS_END + 900));
  // ... more setPhase calls ...
  return () => timers.forEach(clearTimeout);
}, []);
```

Replace it with this expanded form:

```tsx
useEffect(() => {
  const timers: ReturnType<typeof setTimeout>[] = [];

  CITIES.forEach((_, i) => {
    timers.push(setTimeout(() => setImgIdx(i), i * IMG_DURATION));
  });
  timers.push(setTimeout(() => setImgVisible(false), IMGS_END + 200));
  timers.push(setTimeout(() => setPhase(1), IMGS_END + 900));
  timers.push(setTimeout(() => setPhase(2), IMGS_END + 3200));
  timers.push(setTimeout(() => setPhase(3), IMGS_END + 3900));
  timers.push(setTimeout(() => setPhase(4), IMGS_END + 5000));

  const skip = () => {
    timers.forEach(clearTimeout);
    setImgVisible(false);
    setPhase(4);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      // We can't check `phase` from this closure (stale); use a ref or check inside the setter.
      // Simpler: skip() is idempotent — calling it after phase >= 4 is harmless.
      skip();
    }
  };

  window.addEventListener('keydown', onKey);

  return () => {
    timers.forEach(clearTimeout);
    window.removeEventListener('keydown', onKey);
    document.body.style.overflow = '';
  };
}, []);
```

Note: storing `skip` outside the effect would also work but adds a ref. Calling `skip()` after phase 4 is harmless because all timers are already cleared and `setPhase(4)` is a no-op when state is already 4.

- [ ] **Step 2: Wire click-to-skip on the hero container**

Find the hero container in the JSX (the outer `<section>` or `<div>` that wraps the animation, somewhere around line ~300). Add a click handler that calls `skip()`. The `skip` function from the `useEffect` isn't in scope at JSX level — declare a stable `skipFnRef` and have the effect populate it.

First, ensure `useRef` is in the React import at the top of `src/app/page.tsx`. If the existing import is `import { useState, useEffect } from 'react';`, change to `import { useState, useEffect, useRef } from 'react';`.

Then add inside the component body, above `useEffect`:

```tsx
const skipFnRef = useRef<(() => void) | null>(null);
```

Inside `useEffect`, after declaring `skip`:

```tsx
skipFnRef.current = skip;
```

Then in JSX, on the hero container:

```tsx
<div
  onClick={() => skipFnRef.current?.()}
  style={{ /* existing styles */ }}
>
```

- [ ] **Step 3: Stop propagation on CTAs so a click on them doesn't also skip**

Find the CTA `<Link>` elements in the hero (the "Sign in" and "Get started" buttons rendered when `phase >= 4`). Each gets:

```tsx
<Link
  href="/login"
  onClick={(e) => e.stopPropagation()}
  style={{ /* ... */ }}
>
```

The CTAs only become interactive at phase 4, but a fast double-event could still race; the stopPropagation makes it deterministic.

- [ ] **Step 4: Browser smoke check**

Run: `npm run dev`. Open `http://localhost:3000`.

Verify (manual, no automated test):
- Press `Enter` during the intro → instantly jumps to phase 4 (nav + CTAs visible)
- Press `Escape` during the intro → same
- Click anywhere on the hero during the intro → same
- Click the "Sign in" button after the intro → navigates to `/login` (no skip artifact)
- Refresh, let the intro play through normally → still works

Stop the dev server.

- [ ] **Step 5: Run automated checks**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: green tests, clean tsc, successful build.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "Add skip handler to intro animation (#19)

Enter / Escape / click-on-hero advance to phase 4 instantly. CTAs use
stopPropagation so a button click doesn't also fire the skip."
```

---

## Task 5: Replace the intro animation with letter-level layout transition

**Files:**
- Modify: `src/app/page.tsx` (the entire hero animation block: phases 1–3 JSX at lines ~337–436, the keyframes at lines ~91–112 inside `<style>`, the pulse ring at ~397, the hero wordmark at ~434, plus the `// 3 = destify visible` comment at line 10)

This is the biggest task. Split into discrete steps.

- [ ] **Step 1: Remove obsolete keyframes and the pulse ring**

In `src/app/page.tsx`, find the `<style>{...}</style>` block near the top of the JSX (around line 90). Remove the `@keyframes destify-bloom` and `@keyframes ring-out` rules entirely. Keep `@keyframes scroll-bob`, `@keyframes marquee-left`, and `@keyframes marquee-right` — they're used elsewhere on the page.

After this step the `<style>` block should contain only the three remaining keyframes.

- [ ] **Step 2: Update the phase-comment at line 10**

Line 10 says `// 3 = destify visible`. After this task, phase 3 means "wordmark assembling," not "destify visible." Replace lines 7–11 (or wherever the phase legend lives) with an updated comment, e.g.:

```ts
// Animation phases:
//   0 = city marquee
//   1 = tagline fades in (stacked)
//   2 = tagline flattens to a single horizontal row
//   3 = letters shuffle into the Destified wordmark
//   4 = nav + CTAs visible (final state)
```

If the existing legend uses different wording, replace it to reflect the four real phases.

- [ ] **Step 3: Add motion imports and letter constants near the top of page.tsx**

After the existing imports, add:

```tsx
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
```

And below the imports, before the component, add letter constants:

```tsx
const DEST_CHARS = 'Destinations,'.split('');           // 13 chars (incl. comma)
const SIMP_CHARS = 'simplified'.split('');               // 10 chars
const DEST_SURVIVOR_INDICES = new Set([0, 1, 2, 3]);     // D, e, s, t
const SIMP_SURVIVOR_INDICES = new Set([5, 6, 7, 8, 9]);  // i, f, i, e, d
```

- [ ] **Step 4: Add the reduced-motion check inside the intro useEffect**

At the top of the intro `useEffect` (the one modified in Task 4), check for reduced-motion preference. If true, skip the whole animation:

```tsx
useEffect(() => {
  const prefersReduced = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    setImgVisible(false);
    setPhase(4);
    return; // no timers, no keydown listener
  }

  // ... existing timer setup + skip() + keydown listener from Task 4 ...
}, []);
```

The early-return means no listener registered, no timers scheduled. The cleanup function from the non-reduced path won't run — that's fine because the early-return short-circuits before any cleanup is needed.

- [ ] **Step 5: Replace the phases 1–3 hero JSX with the Motion-based animation**

Find the hero JSX block — currently lines ~328 to ~437 — that renders:
1. The outer hero container with `position: 'absolute'` and `maxWidth: 960`
2. The "Destinations, / simplified" stacked block (phases 1–2)
3. The pulse ring (phase 3+)
4. The "Destify" wordmark (phase 3+)

Replace everything from the start of that hero container down to the closing `</div>` of the "Destify" wordmark block (i.e., from the `position: 'absolute'` container to just before the "Tagline + CTA — phase 4" comment) with this single block:

```tsx
<div
  onClick={() => skipFnRef.current?.()}
  style={{
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 2,
    width: '100%',
    maxWidth: 960,
    height: 220,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: phase < 4 ? 'pointer' : 'default',
  }}
>
  {phase < 4 ? (
    <LayoutGroup>
      <motion.div
        layout
        style={{
          display: 'flex',
          flexDirection: phase < 2 ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: phase < 2 ? '0.12em' : 0,
        }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* "Destinations," word */}
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <AnimatePresence>
            {DEST_CHARS.map((ch, i) => {
              if (phase >= 3 && !DEST_SURVIVOR_INDICES.has(i)) return null;
              return (
                <motion.span
                  key={`dest-${i}`}
                  layout
                  initial={{ opacity: 0, y: -22 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
                  style={{
                    display: 'inline-block',
                    fontFamily: 'var(--font-serif), Georgia, serif',
                    fontSize: 'clamp(38px, 6.8vw, 94px)',
                    fontWeight: 500,
                    letterSpacing: '-0.035em',
                    lineHeight: 1,
                    color: 'var(--charcoal)',
                  }}
                >
                  {ch === ' ' ? ' ' : ch}
                </motion.span>
              );
            })}
          </AnimatePresence>
        </div>

        {/* "simplified" word */}
        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <AnimatePresence>
            {SIMP_CHARS.map((ch, i) => {
              if (phase >= 3 && !SIMP_SURVIVOR_INDICES.has(i)) return null;
              return (
                <motion.span
                  key={`simp-${i}`}
                  layout
                  initial={{ opacity: 0, y: 22 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    color: SIMP_SURVIVOR_INDICES.has(i) && phase >= 3
                      ? 'var(--sage-deep)'
                      : 'var(--terracotta)',
                  }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
                  style={{
                    display: 'inline-block',
                    fontFamily: 'var(--font-serif), Georgia, serif',
                    fontSize: 'clamp(38px, 6.8vw, 94px)',
                    fontWeight: 500,
                    letterSpacing: '-0.035em',
                    lineHeight: 1,
                    fontStyle: 'italic',
                  }}
                >
                  {ch === ' ' ? ' ' : ch}
                </motion.span>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>
    </LayoutGroup>
  ) : (
    /* Static wordmark at phase 4 — matches nav style, scaled up */
    <div
      style={{
        fontFamily: 'var(--font-serif), Georgia, serif',
        fontSize: 'clamp(52px, 8.5vw, 116px)',
        fontWeight: 500,
        letterSpacing: '-0.035em',
        lineHeight: 1,
        color: 'var(--charcoal)',
      }}
    >
      Dest<em style={{ fontStyle: 'italic', color: 'var(--sage-deep)' }}>ified</em>
    </div>
  )}
</div>
```

Key notes about this block:
- `phase < 4` renders the animated letter scaffold; `phase >= 4` renders the static wordmark
- Both Destinations and simplified are rendered side-by-side at phase 2+ via the row flex on the outer `motion.div`
- Surviving letters maintain their stable keys (`dest-N`, `simp-N`) so Motion's FLIP carries identity through layout changes
- Non-survivors are filtered out at `phase >= 3` (returning `null` from the `.map`), which triggers `<AnimatePresence>`'s exit animation
- The color tween on "ified" letters runs on the same 0.65s `transition` as their layout movement
- The `cursor` switches to `pointer` during the animation, signaling the hero is clickable to skip

- [ ] **Step 6: Verify the page still type-checks**

Run: `npx tsc --noEmit`
Expected: clean. Any error here is almost certainly a copy-paste artifact in Step 5 — fix and re-run.

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: success. Bundle size will grow by ~30KB (motion). Check the "First Load JS" column for `/` route — it should increase modestly but stay under reasonable limits (~250KB total).

- [ ] **Step 8: Browser smoke test — full intro**

Run: `npm run dev`. Open `http://localhost:3000`.

Verify in the browser:
- Cities marquee plays (phase 0)
- "Destinations," and "simplified" fade in stacked (phase 1, around 1s in)
- The words flatten into a single row (phase 2, around 2s in)
- Letters shuffle into "Destified," dropped letters fade and collapse, "ified" letters tween from terracotta to sage-deep (phase 3, around 3s in)
- Nav + CTAs appear; the static wordmark is visible (phase 4, around 3.5s in)
- No console errors

If the letters jump or the layout shifts unexpectedly: the most likely cause is missing `display: 'inline-block'` on the motion.span (already in the JSX above) or the parent `motion.div`'s `flexDirection` not animating. Re-check the styles.

- [ ] **Step 9: Browser smoke test — skip + reduced-motion**

Same dev server. Verify:
- Press Enter mid-animation → instantly to phase 4 (static wordmark + nav)
- Press Escape mid-animation → same
- Click anywhere on the hero mid-animation → same
- Open DevTools → Rendering → Emulate CSS prefers-reduced-motion → reduce. Hard-reload (Cmd-Shift-R). Page should load directly at phase 4 with no animation timers firing.

Stop the dev server.

- [ ] **Step 10: Commit**

```bash
git add src/app/page.tsx
git commit -m "Rebuild intro animation: letter-level layout transition (#19)

\"Destinations, simplified\" assembles into \"Destified\" via per-letter
motion.span layout transitions inside a LayoutGroup. The \"ified\"
letters color-tween terracotta → sage-deep on the final phase.
Dropped letters fade via AnimatePresence. The shrink-and-bloom phases,
pulse ring, and bloom/ring-out keyframes are removed.

prefers-reduced-motion: reduce mounts the static wordmark immediately
with no animation timers scheduled."
```

---

## Task 6: Final verification

**Files:** None. This task verifies the integrated system end to end.

- [ ] **Step 1: Tests + types + lint + build**

Run: `npm test`
Expected: 70/70 pass.

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run lint`
Expected: no new errors. The 2 pre-existing errors in `src/app/login/page.tsx` (line 294, around the quote that got re-edited in Task 3) may need re-checking — if the unescaped-quote lint error has shifted lines, confirm it's the same pre-existing issue and not a new one.

Run: `npm run build`
Expected: success. All 6 routes built.

- [ ] **Step 2: Full browser walkthrough**

Run `npm run dev` and step through the spec's checklist:

1. Default flow (no skip): cities marquee → stacked tagline fades in → words flatten to row → letters shuffle into Destified wordmark with terracotta → sage-deep color shift → nav + CTAs fade in
2. Skip via Enter from phase 0, 1, 2, or 3: instant phase 4, no stale timer fires
3. Skip via Escape: same
4. Skip via click on hero: same; clicking a CTA still navigates instead of just skipping
5. `prefers-reduced-motion: reduce` (DevTools → Rendering): phase 4 renders on mount, no marquee, no animation timers
6. Nav wordmark says "Destified" (charcoal Dest + italic sage-deep ified)
7. Topbar wordmark on the organizer page says "Destified" (sans-style span)
8. Login page mobile wordmark + img alt + testimonial quote all say "Destified"
9. Page title in the browser tab says "Destified — plan trips, slowly."
10. No console errors at any step
11. Hard reload (Cmd-Shift-R) replays the full intro

- [ ] **Step 3: Push and close the issue**

```bash
git push origin main
gh issue close 19 --comment "Shipped in $(git rev-parse --short HEAD).

Rename Destify → Destified is complete across user-visible copy,
wordmarks, and folder structure. Skip handler responds to Enter,
Escape, or click on the hero. The intro animation now assembles
'Destified' letter-by-letter from 'Destinations, simplified' via
Motion layout transitions, with the 'ified' letters tweening
terracotta → sage-deep.

External rename steps (GitHub repo + Vercel project) remain — they
are manual settings tweaks per the spec."
```

- [ ] **Step 4: External renames (manual, optional now)**

If you want to land these alongside the code rename:

```bash
gh repo rename Destified
git remote set-url origin git@github.com:Ian-q/Destified.git
```

Vercel project rename: Dashboard → Project Settings → General → Project Name → `destified`. The Vercel project ID stays stable; `.vercel/repo.json` (gitignored) needs no edits.

---

## Wrap-up

After Task 6 ships, this PR has:

- Renamed Destify → Destified everywhere user-visible: page title, wordmarks (nav + topbar + login), copy, README, CSS palette comments, package name, folder structure.
- Kept internal identifiers stable: cookie name, demo email domain, CSS variables.
- Added a skip handler (Enter, Escape, click) that respects `prefers-reduced-motion`.
- Replaced the shrink-and-bloom intro with a letter-level layout transition via Motion. The final wordmark assembles from "Destinations, simplified" with a color narrative on the surviving "ified" letters.
- Filed the GitHub repo rename and Vercel project rename as manual follow-ups (they don't block the PR).

Out of scope items remain in the spec and on GitHub:
- Issue #19 doesn't need follow-up issues beyond the manual external rename steps.
