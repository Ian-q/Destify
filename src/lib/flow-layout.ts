"use client";

import ELK, { type ElkNode } from "elkjs/lib/elk.bundled.js";
import type { FlowGraph, FlowNode } from "@/lib/trip-data";

const elk = new ELK();

// Fixed node sizes per kind. Elk lays out using bounding boxes; the diamond's
// visual interior is smaller than its bbox, so we pad it generously.
export const NODE_SIZE: Record<FlowNode["kind"], { width: number; height: number }> = {
  start: { width: 220, height: 60 },
  end: { width: 240, height: 60 },
  decision: { width: 280, height: 200 },
  action: { width: 260, height: 150 },
  info: { width: 260, height: 130 },
};

export type LayoutResult = {
  positions: Record<string, { x: number; y: number }>;
  width: number;
  height: number;
};

// Snap layout positions to a 20px grid so React Flow's snapToGrid keeps
// everything pixel-aligned even if the user drags.
const GRID = 20;
const snap = (n: number) => Math.round(n / GRID) * GRID;

// Cluster centers along one axis: any values within `tolerance` of each other
// collapse to a single shared coordinate (their snapped mean). This produces
// the "invisible row/column" feel — elk decides the topology, then we force
// nodes elk picked for the same column to share an X exactly, rather than
// drifting by a few pixels due to width differences.
function clusterCenters(values: number[], tolerance: number): Map<number, number> {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  const clusters: number[][] = [];
  for (const v of unique) {
    const last = clusters[clusters.length - 1];
    if (last && v - last[last.length - 1] < tolerance) {
      last.push(v);
    } else {
      clusters.push([v]);
    }
  }
  const out = new Map<number, number>();
  for (const c of clusters) {
    const mean = c.reduce((a, b) => a + b, 0) / c.length;
    const snapped = snap(mean);
    for (const v of c) out.set(v, snapped);
  }
  return out;
}

/**
 * Lay out a FlowGraph top-down using elk's "layered" algorithm.
 * Decision branches naturally split into separate columns (Mermaid/D2 style).
 *
 * `pinnedToMain` is the set of node ids that should stay on the spine —
 * elk will route these as a vertical line, and yes/no detours will swing
 * out to a parallel column before rejoining.
 */
export async function layoutFlow(flow: FlowGraph): Promise<LayoutResult> {
  const elkNodes: ElkNode[] = flow.nodes.map((n) => ({
    id: n.id,
    width: NODE_SIZE[n.kind].width,
    height: NODE_SIZE[n.kind].height,
    layoutOptions: {
      // Anchor decision nodes on their center so the diamond visually aligns
      // with the spine line.
      "elk.alignment": n.kind === "decision" ? "CENTER" : "CENTER",
    },
  }));

  // Build edges from the graph's `next` and `choices`. Give the "main path"
  // edge (the one marked `on: true`, i.e. the default selection) high priority
  // so elk routes it straight down the spine and pushes detours to side
  // columns. Plain `next` edges also get high priority — they are the spine.
  type ElkEdge = {
    id: string;
    sources: string[];
    targets: string[];
    layoutOptions?: Record<string, string>;
  };
  const elkEdges: ElkEdge[] = [];
  for (const n of flow.nodes) {
    if (n.choices) {
      for (const c of n.choices) {
        elkEdges.push({
          id: `${n.id}-${c.id}`,
          sources: [n.id],
          targets: [c.to],
          layoutOptions: {
            "elk.layered.priority.direction": c.on ? "10" : "0",
            "elk.layered.priority.straightness": c.on ? "10" : "0",
          },
        });
      }
    } else if (n.next) {
      elkEdges.push({
        id: `${n.id}-${n.next}`,
        sources: [n.id],
        targets: [n.next],
        layoutOptions: {
          "elk.layered.priority.direction": "10",
          "elk.layered.priority.straightness": "10",
        },
      });
    }
  }

  const layouted = await elk.layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      // Spacing — tuned for the "snaps to grid, sprawls down" feel
      "elk.layered.spacing.nodeNodeBetweenLayers": "90",
      "elk.spacing.nodeNode": "60",
      "elk.spacing.edgeNode": "30",
      "elk.spacing.edgeEdge": "20",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
      "elk.layered.nodePlacement.favorStraightEdges": "true",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      // Orthogonal edge routing for that classic flowchart look
      "elk.edgeRouting": "ORTHOGONAL",
    },
    children: elkNodes,
    edges: elkEdges,
  });

  // Collect raw centers from elk, then cluster X and Y separately so nodes
  // elk placed in the same column share an exact X (and same row → exact Y).
  // Without clustering, two nodes of different widths whose corners snap to
  // the same 20px gridline can have centers ~10px apart, producing tiny
  // zig-zags in the connecting edges.
  const raw = (layouted.children ?? []).map((c) => {
    const w = c.width ?? 0;
    const h = c.height ?? 0;
    return {
      id: c.id,
      cx: (c.x ?? 0) + w / 2,
      cy: (c.y ?? 0) + h / 2,
      w,
      h,
    };
  });

  // Tolerances: tighter than the smallest meaningful node spacing so distinct
  // columns/rows stay distinct, but wide enough to absorb width-induced drift.
  const colMap = clusterCenters(raw.map((r) => r.cx), 80);
  const rowMap = clusterCenters(raw.map((r) => r.cy), 50);

  const positions: Record<string, { x: number; y: number }> = {};
  for (const r of raw) {
    const cx = colMap.get(r.cx) ?? snap(r.cx);
    const cy = rowMap.get(r.cy) ?? snap(r.cy);
    positions[r.id] = { x: cx - r.w / 2, y: cy - r.h / 2 };
  }
  // elkjs types omit `width`/`height` on the root return, but the JS object
  // includes them.
  const root = layouted as unknown as { width?: number; height?: number };
  return {
    positions,
    width: root.width ?? 1200,
    height: root.height ?? 1600,
  };
}
