# Destified

A travel-planning organizer that combines an interactive itinerary, a route map,
and **smart pre-flight checklists driven by a decision-tree flowchart**. Built
on Next.js + shadcn/ui.

The current build is the **trip organizer** view: pick a trip you've already
sketched out and Destified shows it as a vertical timeline alongside a route map
and a right rail of budget / documents / stays. Flight legs are preceded by a
checkpoint card that opens a flowchart of *only the prep steps that actually
apply to you* (passport, visa, prescription rules, JR Pass, IDP, …) — each with
a deep-link to the official source.

The future **trip planner** view (not in this build) will let you search hotels
and flights against a budget and pipe selections back into the organizer.

> Status: v0 scaffold — single demo trip (SFO → HND, Feb 2026). Data is
> hard-coded in `src/lib/trip-data.ts`.

## Tech stack

| Area | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Fast dev loop, SSR-ready for future planner pages |
| UI primitives | shadcn/ui (Nova preset, Radix base) | Accessible, themeable; matches PRD |
| Styling | Tailwind v4 + custom design tokens | Earth-toned palette layered onto shadcn defaults |
| Map | react-leaflet + OpenStreetMap (CARTO light tiles) | No API key needed; great for trans-Pacific arcs and city pins |
| Flowchart canvas | @xyflow/react (React Flow) | Pannable / zoomable graph, custom node renderers, mini-map |
| Client state | zustand | Single store shared between timeline ↔ map ↔ flowchart |
| Icons | lucide-react | Pre-bundled with shadcn Nova preset |

## Project layout

```
src/
├── app/
│   ├── layout.tsx          ← Inter / Fraunces / JetBrains Mono + TooltipProvider
│   ├── globals.css         ← shadcn tokens + Destified earth-toned palette
│   └── page.tsx            ← /  organizer dashboard (top bar → header → grid)
├── components/
│   ├── destified/
│   │   ├── topbar.tsx
│   │   ├── trip-header.tsx        ← title, dates, readiness card
│   │   ├── timeline-panel.tsx     ← day picker + per-day items + checkpoint cards
│   │   ├── route-map.tsx          ← panel chrome + dynamic import of inner map
│   │   ├── route-map-inner.tsx    ← Leaflet client component (great-circle arcs)
│   │   ├── right-rail.tsx         ← budget, checklist docs, stays
│   │   └── flow-modal.tsx         ← React Flow canvas with custom node types
│   └── ui/                        ← shadcn primitives
└── lib/
    ├── trip-data.ts        ← typed Trip, Place, FlowGraph, demo Tokyo data
    └── use-trip-store.ts   ← zustand store + activePath() helper
```

## Getting started

```bash
npm install
npm run dev
# → http://localhost:3000
```

Hit `/` to see the organizer. Click any **dark "checkpoint" card** in the
timeline (or the "Open flowchart" button in the right rail) to launch the
pre-flight flow modal.

### Build / typecheck

```bash
npm run build    # next build (Turbopack)
npx tsc --noEmit # type check
npm run lint     # eslint
```

## How the smart checklist works

`src/lib/trip-data.ts` defines a **`FlowGraph`** per trip — a set of typed
nodes (`start`, `end`, `decision`, `action`, `info`) with absolute canvas
coordinates and either `next` or `choices[]` edges.

`activePath(flowId, choices)` in `src/lib/use-trip-store.ts` walks the graph
from `start`, taking the user's currently selected choice at each decision
node, until it hits `end`. The result drives:

- the **trip-readiness percentage** in the header,
- the **per-checkpoint progress bar** in the timeline,
- the **on-path / dimmed** styling of nodes and edges in the flow modal.

So a US passport holder going to Japan with prescription meds sees a different
path than a family flying with kids and a rental car — the whole graph is
rendered, but only the relevant subgraph is highlighted, and only those nodes
count toward "done."

## Roadmap

- [ ] **Trip planner page** — questionnaire (passport, dates, budget,
      travelers, drive?, meds?, kids?), then live results: ranked flights,
      ranked hotels, suggested activities. Pipes selections into the
      organizer.
- [ ] **Persistence** — Postgres + Drizzle for users, trips, docs, choices.
- [ ] **Real flight + hotel APIs** — Amadeus / Duffel / Skyscanner for flights,
      Booking.com / Hotels.com for stays.
- [ ] **More flow templates** — per-destination decision trees (Schengen,
      Kenya yellow-fever, India e-visa, etc.). Currently only Japan is wired.
- [ ] **Real-map upgrade** — swap CARTO tiles for Mapbox if richer styling is
      needed; add geocoding for free-text place input.
- [ ] **Auth + sharing** — multi-user trips and a public read-only share link.

## License

MIT — see [LICENSE](./LICENSE).
