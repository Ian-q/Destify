# Destified rebrand + intro animation rework (Issue #19)

**Date:** 2026-05-12
**Issue:** [#19](https://github.com/Ian-q/Destify/issues/19)
**Status:** Design ready for implementation

## Goal

Rebrand the product from "Destify" to "Destified" (the available domain), add a user-initiated skip for the landing-page intro animation, and rebuild the intro so its final wordmark assembles letter-by-letter from "Destinations, simplified" — replacing today's shrink-and-bloom.

## Background

`destify.*` domains are taken; `destified` is available and arguably better. The wordmark only changes by one syllable (`Dest` + italic `ify` → `Dest` + italic `ified`), so the rebrand surface is mostly text. The current intro animation (`src/app/page.tsx` phases 0–4) shrinks "Destinations, simplified" to a dot and re-blooms "Destify" — visually fine but unrelated to the surrounding copy. The rebrand creates the opportunity to do better: have the final wordmark *emerge* from the tagline.

Three parts land together because (1) the new animation's final wordmark is the rebranded word, and (2) the skip handler is small and naturally bundled with intro work.

## Part 1 — Rename: Destify → Destified

86 occurrences across 22 files. The rename is mostly user-visible copy; internal identifiers stay.

### What renames

- `package.json` `name`: `destify` → `destified`
- `README.md` prose
- Folder: `src/components/destify/` → `src/components/destified/` (8 files), and every import like `@/components/destify/x` → `@/components/destified/x` across the app
- All user-visible string `"Destify"` → `"Destified"` (page titles, alt text, toast copy, console-rendered branding)
- Wordmark JSX `Dest<em>ify</em>` → `Dest<em>ified</em>` everywhere it appears: nav at `src/app/page.tsx:143`, `src/components/destify/topbar.tsx`, `src/components/destify/right-rail.tsx`, `src/app/login/page.tsx`. The hero at `src/app/page.tsx:434` is replaced wholesale by the new animation (Part 3).
- Code comments that name the product

### What stays internal

- CSS variables (`--font-serif`, `--sage-deep`, `--terracotta`, etc.) — per issue scope
- The `destify-session` cookie name in `src/lib/session.ts` — renaming logs out existing sessions for no user-visible gain
- The demo email domain `@destify.local` in `src/lib/auth-actions.ts` — DB-only, never displayed
- Historical artifacts under `docs/superpowers/specs/` and `docs/superpowers/plans/` — past work, not rewriting history

After this part: the rename grep count drops from 86 to ~6 (cookie name + email domain + historical spec references).

## Part 2 — Skip intro animation

Three triggers advance the intro to phase 4 instantly:

- `keydown` on `Enter`
- `keydown` on `Escape`
- Click anywhere on the hero (except the CTAs, which retain their own click behavior)

### Implementation

Inside the existing intro `useEffect` at `src/app/page.tsx:79`:

```tsx
const skip = () => {
  timers.forEach(clearTimeout);   // cancel pending phase transitions
  setImgVisible(false);            // clear the marquee state
  setPhase(4);
};

const onKey = (e: KeyboardEvent) => {
  if (phase >= 4) return;
  if (e.key === 'Enter' || e.key === 'Escape') skip();
};

window.addEventListener('keydown', onKey);

return () => {
  timers.forEach(clearTimeout);
  window.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';   // existing cleanup
};
```

Click-to-skip wires `onClick={skip}` on the hero container. CTA `<Link>` children get explicit `e.stopPropagation()` so a fast click can't simultaneously skip and navigate. The handler is guarded by an early-return on `phase >= 4`, so multi-trigger races are harmless.

### Edge cases

- Focus inside a CTA + Enter: link navigation wins; skip handler still fires but `phase >= 4` shortly after — no visible glitch.
- `prefers-reduced-motion: reduce`: render phase 4 immediately on mount, skip phases 1–3 entirely (see Part 3).

## Part 3 — Animation rework

Replace the current shrink-and-bloom (phases 1–3 in `src/app/page.tsx`) with a letter-level layout transition. Letters from "Destinations," and "simplified" survive into the wordmark; the rest fade out.

### Letter accounting

- "Destinations," (12 letters + comma): keep `D-e-s-t` (positions 0–3), drop `i-n-a-t-i-o-n-s-,` (positions 4–12)
- "simplified" (10 letters): keep `i-f-i-e-d` (positions 5–9), drop `s-i-m-p-l` (positions 0–4)
- Target wordmark `Destified` (9 letters): `D-e-s-t` (charcoal, upright) + `i-f-i-e-d` (italic, sage-deep)

Each letter is a `<motion.span layout>` with a stable key (e.g., `dest-D`, `simp-i-5`). Survivor spans persist across all transitions. Dropped spans are wrapped in `<AnimatePresence>` and animate exit.

### Phase sequence (~3.2s total, down from ~5s)

**Phase 0** (0 → ~0.7s) — Existing city-image marquee, unchanged.

**Phase 1** (~0.7s → ~1.8s) — "Destinations," and "simplified" fade in **stacked vertically**, matching the current intro's typography (charcoal upright on top, italic terracotta below).

**Phase 2** (~1.8s → ~2.6s) — **First layout transition.** Words flatten to a single horizontal row at the same baseline. "Destinations," shifts up and slightly left; "simplified" shifts up onto the row, just right of "Destinations,". The comma fades. Motion handles the FLIP via `<LayoutGroup>` + per-letter `layout` props.

**Phase 3** (~2.6s → ~3.2s) — **Second layout transition.** Letters shuffle into final wordmark positions:

- Surviving `D-e-s-t` letters land in the wordmark "Dest" position
- Surviving `i-f-i-e-d` letters slide left to butt up against the `t` with no gap
- Dropped letters (`inations,` and `simpl`) fade `opacity: 0` while their `width` collapses to 0
- Each "ified" letter `color` tweens from `var(--terracotta)` → `var(--sage-deep)` over the same 0.6s
- Italic style on "ified" persists from "simplified" through the transition

**Phase 4** (~3.2s onward) — Static wordmark renders the same JSX as the nav (`Dest<em style={{ color: 'var(--sage-deep)' }}>ified</em>`). Nav bar, tagline, and CTAs fade in via existing phase-4 logic. The letter-span scaffolding is unmounted; only the static wordmark stays.

### Removed elements

- The pulse-ring effect at `src/app/page.tsx:398`. The new wordmark assembles in place; a bloom is redundant.
- The `destify-bloom` and `ring-out` keyframes in the `<style>` block at `src/app/page.tsx:90`.

### Motion APIs used

- `<LayoutGroup>` — wraps the hero so all per-letter spans share a layout coordinate space.
- `<motion.span layout layoutId="…">` — per-letter; FLIP transition between phases.
- `<AnimatePresence>` — wraps dropped letters; `exit` prop drives the fade + width collapse.
- `animate={{ color }}` for "ified" letters — color tween during phase 3.
- `transition={{ duration, ease: [...] }}` — overrides Motion's spring default with a smoother ease for typographic landing (springs feel bouncy on text).

### Skip integration

The Part 2 skip handler sets `phase = 4`. The letter-span scaffolding only renders when `phase < 4`; at phase 4 the static wordmark renders directly. Skipping mid-transition causes Motion to interrupt cleanly because we render different JSX rather than tweening to the final state.

### Reduced-motion fallback

A check via `window.matchMedia('(prefers-reduced-motion: reduce)').matches` inside the intro `useEffect`. When true, skip phases 1–3 entirely: mount at phase 4, skip the marquee too, no animation timers scheduled.

## Architecture summary

| Concern | Location |
|---|---|
| Rename folder | `src/components/destify/` → `src/components/destified/` |
| Wordmark JSX | nav + topbar + right-rail + login — `Dest<em>ified</em>` everywhere |
| Skip handler | inline in `src/app/page.tsx` intro `useEffect` |
| New animation | inline in `src/app/page.tsx` hero section (existing phases 1–3 JSX replaced) |
| Reduced-motion | early-return inside same `useEffect` |
| New dependency | `motion` (the package, formerly `framer-motion`) — added to `package.json` |

No new files for the animation; this stays inline in `page.tsx`. The hero section gains a new `<LayoutGroup>` containing per-letter `<motion.span>`s.

## Testing

Per saved feedback memory, UI features require a browser walkthrough before push. Unit tests aren't sufficient for animation timing or layout-FLIP correctness.

**Browser walkthrough checklist:**

- Default flow (no skip): cities marquee → stacked tagline fades in → words slide together → wordmark assembles with "ified" terracotta → sage-deep color shift → nav + CTAs appear
- Skip via `Enter`: any phase 0–3 → phase 4 immediately, no stale timers fire
- Skip via `Escape`: same
- Skip via click on hero: same; clicking a CTA still navigates instead of just skipping
- `prefers-reduced-motion: reduce` (toggle in DevTools): phase 4 renders on mount, no marquee, no animation
- Nav wordmark says "Destified" (rebrand grep visual check)
- Topbar, right-rail, login wordmarks all say "Destified"
- No console errors at any step
- Hard reload (Cmd-Shift-R) replays the full intro

**Automated checks:**

- `npm test` — existing suite must stay green (70 tests). No new unit tests; the animation is presentation-only and the rename touches strings, not logic.
- `npx tsc --noEmit` — clean.
- `npm run lint` — no new errors (the 2 pre-existing errors in `login/page.tsx` stay).
- `npm run build` — success.

## External rename steps (manual, outside the PR)

The PR ships the codebase rename. Two manual settings tweaks happen separately, by you:

**GitHub repo rename** (`Ian-q/Destify` → `Ian-q/Destified`):
- Run `gh repo rename Destified` from the local checkout, or do it via the repo Settings page.
- GitHub auto-redirects all old URLs (clones, issue links, web requests) indefinitely. The three existing spec docs that reference `github.com/Ian-q/Destify/issues/*` keep working without edits.
- Update the local git remote URL: `git remote set-url origin git@github.com:Ian-q/Destified.git` (cosmetic; the redirect would handle pushes either way).

**Vercel project rename** (`destify` → `destified`):
- Done in the Vercel dashboard → Project Settings → General → Project Name. Or via `vercel project rename` if you have the CLI logged in.
- The Vercel project ID (`prj_5XLTlMQZFm8DmjRBXiA0XDIgDfrw`, captured in the gitignored `.vercel/repo.json`) stays stable across rename. No file change needed.
- The auto-generated production URL changes from `destify-*.vercel.app` to `destified-*.vercel.app`. Nothing in the codebase references those URLs (verified by grep), so no code update.
- Environment variables, integrations, deployment hooks: unaffected.

Neither rename is a code change — they're settings tweaks. Do them whenever convenient; the PR doesn't depend on them.

## Out of scope

- Domain purchase / DNS configuration — separate.
- Logo or wordmark in non-text contexts (no current images).
- Cookie-name migration for existing sessions (`destify-session` cookie stays).
- Email-domain rename for demo accounts (`@destify.local` stays).
- Animation polish like easing exploration beyond a reasonable default — first pass uses `ease: [0.4, 0, 0.2, 1]` for the layout transitions.

## Acceptance criteria

- Nav, topbar, right-rail, and login wordmarks all read "Destified" with `Dest` charcoal upright + `ified` italic sage-deep.
- `package.json` `name` is `destified`.
- Folder `src/components/destified/` exists; old `src/components/destify/` does not; all imports updated.
- Pressing Enter, Escape, or clicking the hero during the intro skips to phase 4 instantly with no stale phase transitions.
- The default intro animation runs without the shrink-and-bloom: letters slide from "Destinations, simplified" into "Destified" with the "ified" letters tweening terracotta → sage-deep.
- `prefers-reduced-motion: reduce` results in instant phase 4 with no animation timers scheduled.
- `motion` package added to `dependencies`.
- Browser walkthrough passes the full checklist above.
