# Design system sync — Destify

Tracker for porting the Claude Design handoff bundle into the Next.js app.
Source of truth: `arakYu2RS32LF9xA0UYRFg` design package
(unzipped to `/tmp/destify_design/destify-design-system/`). The bundle's
`README.md` + `chats/chat1.md` capture the user's intent across iterations.

## Status

| ID | Item | Files | Status |
|---|---|---|---|
| F1 | Fraunces → Instrument Serif | `layout.tsx` | ✅ done |
| F2 | Unified token surface (shadows, semantics, tile/brand gradients, page-bg, flow-bg) | `globals.css` | ✅ done |
| F3 | Wordmark sans (no italic, sage-deep "ify") | `topbar.tsx`, `page.tsx`, `login/page.tsx` | ✅ done |
| F4 | Top bar tabs as segmented control with terracotta dot | `topbar.tsx` | ✅ done |
| F5 | Inline brand gradients → `var(--grad-*)` tokens | `topbar.tsx`, `flow-modal.tsx`, `timeline-panel.tsx` | ✅ done |
| A | Doc rows: button-style link section (sand fill, ocean hover) | `right-rail.tsx` | ✅ done |
| B | Trip readiness card: sand-gradient surface + 26px serif % | `trip-header.tsx` | ✅ done |
| D | Flow start pill: cream + sage-deep outline | `flow-modal.tsx` | ✅ done |
| E | Decision diamond: "Decision" label inside, question floats below | `flow-modal.tsx` | ✅ done |
| C | Replace Open Flowchart button with dark progress hero (lavender glow + terracotta dial) | `right-rail.tsx` | ⏳ pending |
| F | Map depart/arrive cues: solid SFO, halo HND, arc arrowhead | `route-map-inner.tsx` | ⏳ pending |

## Skipped on purpose

- Big animated `Destify` hero on `/` landing — kept on serif since it's an
  artistic treatment Greesh tuned to serif metrics. Revisit if unification matters.
- Action-node gradient stops (`#F4E1CC → #FBEDDF` vs current `#FBEDDF → cream`) —
  borderline difference, leaving as-is.
- Hotel swatch size (60px design vs 80px current) — current scale feels right
  in the rail.
- `/login` page's split-panel quote pulls — out of scope for the design bundle.

## Reference

- Design palette/tokens: `colors_and_type.css` (canonical) and `ui_kits/organizer/tokens.css` (kit-local copy)
- Component intent: `chats/chat1.md` is where the user's iteration decisions live
- Preview HTMLs: `project/preview/*.html` — one card per concept, useful for pixel reference
- Hi-fi React mirrors: `project/ui_kits/organizer/*.jsx` — same components in plain JSX
