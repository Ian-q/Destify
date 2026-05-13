"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  Controls,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  type Node,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type NodeTypes,
  type NodeProps,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { TRIP, type FlowGraph, type FlowNode } from "@/lib/trip-data";
import { useTripStore, activePath } from "@/lib/use-trip-store";
import { layoutFlow, NODE_SIZE } from "@/lib/flow-layout";
import { Check, X, ExternalLink } from "lucide-react";
import { resolveFlowAction } from "@/lib/conditions/actions";

type NodeData = FlowNode & {
  flowId: string;
  isOnPath: boolean;
  isDone: boolean;
  selectedChoice?: string;
  autoResolved?: { ruleId: string; reason: string };
};

export function FlowModal() {
  const { flowOpen, closeFlow } = useTripStore();
  const flow = flowOpen ? TRIP.flows[flowOpen] : null;
  return (
    <Dialog open={!!flow} onOpenChange={(open) => (open ? null : closeFlow())}>
      <DialogContent
        className="!w-[min(1180px,96vw)] !max-w-none !p-0 overflow-hidden"
        style={{
          height: "min(800px, 92vh)",
          background: "var(--cream)",
          borderRadius: 22,
        }}
        showCloseButton={false}
      >
        {flow ? <FlowView flow={flow} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function FlowView({ flow }: { flow: FlowGraph }) {
  const { closeFlow, flowDone, flowChoices, resetFlowChoices } = useTripStore();

  const path = activePath(flow.id, flowChoices[flow.id] ?? {});
  const pathSet = useMemo(() => new Set(path), [path]);
  const trail = useMemo(
    () =>
      path
        .map((id) => flow.nodes.find((n) => n.id === id))
        .filter(Boolean) as FlowNode[],
    [path, flow]
  );

  const items = trail.filter((n) => n.kind !== "start" && n.kind !== "end");
  const total = items.length;
  const done = items.filter((n) => flowDone[flow.id]?.[n.id]).length;
  const pct = total ? Math.round((done * 100) / total) : 0;

  return (
    <div className="grid h-full grid-rows-[auto_1fr_auto]">
      <DialogHeader
        className="px-6 pb-3.5 pt-4.5 border-b"
        style={{ background: "var(--cream-warm)", borderColor: "rgba(148,139,130,.12)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div
              className="mb-1 text-[11px] uppercase tracking-[0.1em]"
              style={{ color: "var(--mocha)" }}
            >
              {flow.subtitle}
            </div>
            <DialogTitle className="font-serif text-2xl font-medium">
              {flow.title.includes("Japan") ? (
                <>
                  Before you fly to{" "}
                  <em
                    className="not-italic"
                    style={{ fontStyle: "italic", color: "var(--terracotta)" }}
                  >
                    Japan
                  </em>
                </>
              ) : (
                flow.title
              )}
            </DialogTitle>
            <DialogDescription style={{ color: "var(--mocha)", fontSize: 12.5 }}>
              Answer each branch — we&apos;ll only show what applies to you. Drag to pan, scroll to zoom.
            </DialogDescription>
          </div>
          <DialogClose
            onClick={closeFlow}
            className="grid h-8.5 w-8.5 place-items-center rounded-md border-0"
            style={{ background: "var(--sand)", color: "var(--charcoal)", height: 34, width: 34 }}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </DialogClose>
        </div>
      </DialogHeader>

      <div className="relative">
        <div className="absolute left-4 top-4 z-10 flex gap-1.5">
          <button
            id="flow-fit-trigger"
            className="rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur"
            style={{
              background: "rgba(253,251,247,.92)",
              borderColor: "rgba(148,139,130,.2)",
              color: "var(--charcoal-soft)",
            }}
          >
            Fit to screen
          </button>
          <button
            onClick={() => resetFlowChoices(flow.id)}
            className="rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur"
            style={{
              background: "rgba(253,251,247,.92)",
              borderColor: "rgba(148,139,130,.2)",
              color: "var(--charcoal-soft)",
            }}
          >
            Reset answers
          </button>
        </div>

        <ReactFlowProvider>
          <FlowGraphView flow={flow} pathSet={pathSet} />
        </ReactFlowProvider>
      </div>

      <div
        className="flex items-center justify-between gap-4 border-t px-6 py-3"
        style={{ background: "var(--cream-warm)", borderColor: "rgba(148,139,130,.12)" }}
      >
        <div className="min-w-0">
          <div className="text-[13px]" style={{ color: "var(--charcoal-soft)" }}>
            <strong
              className="font-serif text-[16px] font-medium"
              style={{ color: "var(--charcoal)" }}
            >
              {pct}%
            </strong>{" "}
            <span className="ml-1.5">
              {done} of {total} on your path · {total - done} pending
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {trail.map((n, i) => {
              const short =
                n.kind === "start"
                  ? "Start"
                  : n.kind === "end"
                    ? "Done"
                    : n.title.split(/[·:]/)[0].slice(0, 22).trim();
              const isLast = i === trail.length - 1;
              return (
                <span key={n.id} className="flex items-center gap-1.5">
                  <span
                    className="rounded-full border px-2 py-0.5 font-mono text-[10.5px]"
                    style={{
                      background: isLast ? "var(--charcoal)" : "var(--cream)",
                      color: isLast ? "var(--cream)" : undefined,
                      borderColor: isLast ? "var(--charcoal)" : "rgba(148,139,130,.2)",
                    }}
                  >
                    {short}
                  </span>
                  {!isLast && (
                    <span style={{ color: "var(--mocha)", fontSize: 10 }}>→</span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-full border px-3 py-1.5 text-[13px]"
            style={{
              background: "var(--cream)",
              borderColor: "rgba(148,139,130,.2)",
            }}
          >
            Email me reminders
          </button>
          <button
            className="rounded-full px-3 py-1.5 text-[13px] font-medium"
            style={{ background: "var(--sage-deep)", color: "var(--cream)" }}
          >
            Save to Apple Wallet
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Graph ────────────────────────────────────────────────────────────

function FlowGraphView({ flow, pathSet }: { flow: FlowGraph; pathSet: Set<string> }) {
  const { flowDone, flowChoices, flowResolved } = useTripStore();
  const applyResolution = useTripStore((s) => s.applyResolution);
  const rf = useReactFlow();
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }> | null>(null);

  // Hydrate conditions data and auto-resolve flow choices on open.
  // Runs via a Server Action so the DB client stays server-only; profile/context
  // and the active leg are derived server-side from the session + trip.
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

  // Compute layered layout once per flow (geometry doesn't change with choices —
  // only highlighting does, which keeps the user's mental map stable).
  useEffect(() => {
    let cancelled = false;
    layoutFlow(flow).then((res) => {
      if (!cancelled) setPositions(res.positions);
    });
    return () => {
      cancelled = true;
    };
  }, [flow]);

  const { nodes, edges } = useMemo(() => {
    if (!positions) return { nodes: [] as Node<NodeData>[], edges: [] as Edge[] };

    const nodes: Node<NodeData>[] = flow.nodes.map((n) => {
      const size = NODE_SIZE[n.kind];
      const resolved = flowResolved[flow.id]?.[n.id];
      const currentChoice = flowChoices[flow.id]?.[n.id];
      // Only treat as auto-resolved when the displayed choice still matches what the rule
      // resolved to. A user manual setFlowChoice or a resetFlowChoices that landed on a
      // different default would otherwise leave a stale "Auto" pill claiming credit for a
      // choice the rule did not produce.
      const autoMatch = resolved && currentChoice === resolved.choiceId;
      return {
        id: n.id,
        type:
          n.kind === "decision" ? "diamondNode" :
          n.kind === "start" || n.kind === "end" ? "pillNode" :
          "rectNode",
        position: positions[n.id] ?? { x: 0, y: 0 },
        data: {
          ...n,
          flowId: flow.id,
          isOnPath: pathSet.has(n.id),
          isDone: !!flowDone[flow.id]?.[n.id],
          selectedChoice: currentChoice,
          autoResolved: autoMatch ? { ruleId: resolved.ruleId, reason: resolved.reason } : undefined,
        },
        width: size.width,
        height: size.height,
        draggable: false,
        selectable: false,
      };
    });

    // Pick which side of a decision diamond an edge exits from based on where
    // elk placed the target. Detours into a side column exit the matching tip
    // (Mermaid/D2-style); the spine continuation exits the bottom.
    const sideOf = (sourceId: string, targetId: string): "left" | "right" | "bottom" => {
      const s = positions[sourceId];
      const t = positions[targetId];
      const sNode = flow.nodes.find((n) => n.id === sourceId);
      const tNode = flow.nodes.find((n) => n.id === targetId);
      if (!s || !t || !sNode || !tNode) return "bottom";
      const sCenter = s.x + NODE_SIZE[sNode.kind].width / 2;
      const tCenter = t.x + NODE_SIZE[tNode.kind].width / 2;
      const delta = tCenter - sCenter;
      if (delta < -40) return "left";
      if (delta > 40) return "right";
      return "bottom";
    };

    const edges: Edge[] = [];
    for (const n of flow.nodes) {
      if (n.choices) {
        for (const c of n.choices) {
          const isActive =
            pathSet.has(n.id) && (flowChoices[flow.id]?.[n.id] === c.id) && pathSet.has(c.to);
          const sourceHandle = n.kind === "decision" ? sideOf(n.id, c.to) : undefined;
          edges.push({
            id: `${n.id}-${c.id}`,
            source: n.id,
            target: c.to,
            sourceHandle,
            label: c.label.split(" · ")[0],
            type: "ortho",
            style: {
              stroke: isActive ? "#6E8068" : "#C9C2BB",
              strokeWidth: isActive ? 2.4 : 1.6,
              opacity: isActive ? 1 : 0.55,
              fill: "none",
            },
            labelStyle: {
              fontFamily: "var(--font-mono), ui-monospace, monospace",
              fontSize: 11,
              fontWeight: 500,
              fill: isActive ? "#2C3033" : "#6B6964",
            },
            labelBgStyle: { fill: "#FDFBF7", fillOpacity: 0.95 },
            labelBgPadding: [6, 3],
            labelBgBorderRadius: 6,
            markerEnd: undefined,
          });
        }
      } else if (n.next) {
        const isActive = pathSet.has(n.id) && pathSet.has(n.next);
        edges.push({
          id: `${n.id}-${n.next}`,
          source: n.id,
          target: n.next,
          type: "ortho",
          style: {
            stroke: isActive ? "#6E8068" : "#C9C2BB",
            strokeWidth: isActive ? 2.4 : 1.6,
            opacity: isActive ? 1 : 0.55,
            fill: "none",
          },
        });
      }
    }
    return { nodes, edges };
  }, [flow, pathSet, flowDone, flowChoices, positions]);

  // After layout lands, center near the top of the spine at a readable zoom
  // (0.85). The Fit-to-screen toolbar button still does a true full-graph fit.
  useEffect(() => {
    if (!positions) return;
    const t = setTimeout(() => {
      const startNode = flow.nodes.find((n) => n.kind === "start");
      const startPos = startNode ? positions[startNode.id] : null;
      if (!startPos) {
        rf.fitView({ padding: 0.18, duration: 320 });
        return;
      }
      // Center on the start node at zoom 0.85, slightly offset down so we can
      // see the next 2-3 nodes below.
      rf.setViewport(
        {
          x: 0,
          y: 0,
          zoom: 0.85,
        },
        { duration: 0 }
      );
      // Then center on the start node's center
      const size = NODE_SIZE[startNode!.kind];
      rf.setCenter(startPos.x + size.width / 2, startPos.y + 220, {
        zoom: 0.85,
        duration: 320,
      });
    }, 50);
    return () => clearTimeout(t);
  }, [rf, flow.id, positions]);

  useEffect(() => {
    const handler = () => rf.fitView({ padding: 0.18, duration: 320 });
    const btn = document.getElementById("flow-fit-trigger");
    btn?.addEventListener("click", handler);
    return () => btn?.removeEventListener("click", handler);
  }, [rf]);

  return (
    <div
      style={{
        height: "100%",
        background:
          "radial-gradient(circle, rgba(148,139,130,.18) 1px, transparent 1px) 0 0 / 20px 20px, linear-gradient(180deg, var(--cream) 0%, #F8F4EC 100%)",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        defaultViewport={{ x: 0, y: 0, zoom: 0.85 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        snapToGrid
        snapGrid={[20, 20]}
        panOnDrag
      >
        <Background gap={20} size={1} color="rgba(148,139,130,0)" />
        <Controls
          showInteractive={false}
          position="bottom-left"
          style={{ marginBottom: 16, marginLeft: 16 }}
        />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(253,251,247,0.6)"
          nodeColor={(n) => ((n.data as NodeData).isOnPath ? "#8B9D83" : "#C9C2BB")}
          style={{
            background: "rgba(253,251,247,.92)",
            border: "1px solid rgba(148,139,130,.2)",
            borderRadius: 10,
          }}
        />
      </ReactFlow>
    </div>
  );
}

// ─── Node renderers ────────────────────────────────────────────────────

function PillNode({ data }: NodeProps<Node<NodeData>>) {
  const isStart = data.kind === "start";
  return (
    <div
      className="grid h-full place-items-center rounded-full px-5 text-center shadow-sm"
      style={{
        width: NODE_SIZE[data.kind].width,
        height: NODE_SIZE[data.kind].height,
        background: isStart ? "var(--cream)" : "var(--grad-pill)",
        color: isStart ? "var(--charcoal)" : "var(--cream)",
        border: "1.5px solid",
        borderColor: isStart ? "rgba(139,157,131,.7)" : "var(--sage-deep)",
      }}
    >
      <div>
        <div
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: isStart ? "var(--sage-deep)" : "rgba(253,251,247,.6)" }}
        >
          {data.label}
        </div>
        <div className="mt-1 text-[13.5px] font-semibold tracking-tight">{data.title}</div>
      </div>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

function RectNode({ data }: NodeProps<Node<NodeData>>) {
  const { toggleFlowDone, flowInfo } = useTripStore();
  const size = NODE_SIZE[data.kind];

  const info = data.kind === "info" ? flowInfo[data.flowId]?.[data.id] : undefined;
  const title = info?.title ?? data.title;
  const desc = info?.desc ?? data.desc;
  const meta = info?.meta ?? data.meta;
  const state = info?.state;

  const bg =
    data.kind === "action"
      ? "linear-gradient(180deg, #FBEDDF, var(--cream))"
      : data.kind === "info"
        ? "var(--sand)"
        : "var(--cream)";
  const border =
    data.kind === "action" ? "rgba(192,120,86,.45)" : "rgba(148,139,130,.35)";

  return (
    <div
      className="relative rounded-md border-[1.5px] px-3.5 py-3 shadow-sm transition-shadow hover:shadow-md"
      style={{
        width: size.width,
        height: size.height,
        background: bg,
        borderColor: data.isDone ? "rgba(139,157,131,.55)" : border,
        opacity: data.isOnPath ? 1 : 0.32,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />

      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFlowDone(data.flowId, data.id);
        }}
        className="absolute -left-2.5 -top-2.5 grid h-6 w-6 place-items-center rounded-full border-[1.5px] transition-colors"
        style={{
          background: data.isDone ? "var(--sage-deep)" : "var(--cream)",
          color: data.isDone ? "var(--cream)" : "transparent",
          borderColor: data.isDone ? "var(--sage-deep)" : "var(--mocha-soft)",
        }}
        aria-label="Toggle done"
      >
        <Check className="h-3.5 w-3.5" />
      </button>

      <div
        className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em]"
        style={{ color: "var(--mocha)" }}
      >
        {(state === "warn" || state === "fail") && (
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "#C07856" }}
          />
        )}
        {data.label}
      </div>
      <div className="mt-1 text-[13.5px] font-semibold leading-snug tracking-tight">
        {title}
      </div>
      {desc && (
        <div
          className="mt-1.5 line-clamp-3 text-[11.5px] leading-snug"
          style={{ color: "var(--charcoal-soft)" }}
        >
          {desc}
        </div>
      )}
      {meta && (
        <div
          className="mt-1.5 font-mono text-[10.5px]"
          style={{ color: "var(--mocha)" }}
        >
          {meta}
        </div>
      )}
      {data.link && (
        <a
          href={data.link.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-2.5 left-3.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px]"
          style={{
            background: "var(--cream)",
            borderColor: "rgba(45,90,123,.25)",
            color: "var(--ocean)",
          }}
        >
          {data.link.label} <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function DiamondNode({ data }: NodeProps<Node<NodeData>>) {
  const { setFlowChoice } = useTripStore();
  const size = NODE_SIZE[data.kind];
  const w = size.width;
  const h = size.height;

  // Diamond occupies the top ~65% of the bbox; the question floats below.
  // This matches the design intent of "Decision in the center of the diamond,
  // with the question floating underneath it" instead of squishing copy inside.
  const diamondH = Math.round(h * 0.65);
  const diamondMidY = diamondH / 2;
  const onPath = data.isOnPath;

  return (
    <div className="relative" style={{ width: w, height: h }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, top: 0 }} />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0, top: diamondH, bottom: "auto" }}
      />
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        style={{ opacity: 0, top: diamondMidY }}
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        style={{ opacity: 0, top: diamondMidY }}
      />

      <svg
        width={w}
        height={diamondH}
        viewBox={`0 0 ${w} ${diamondH}`}
        className="absolute left-0 top-0"
        style={{ opacity: onPath ? 1 : 0.32 }}
      >
        <defs>
          <linearGradient id={`dia-${data.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F5EFFB" />
            <stop offset="1" stopColor="#FDFBF7" />
          </linearGradient>
        </defs>
        <polygon
          points={`${w / 2},2 ${w - 2},${diamondMidY} ${w / 2},${diamondH - 2} 2,${diamondMidY}`}
          fill={`url(#dia-${data.id})`}
          stroke={data.isDone ? "rgba(139,157,131,.55)" : "rgba(184,168,216,.7)"}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>

      <div
        className="absolute left-0 right-0 grid place-items-center gap-1"
        style={{ top: 0, height: diamondH, opacity: onPath ? 1 : 0.32 }}
      >
        <span
          className="font-mono text-[10px] font-semibold uppercase"
          style={{ color: "#5C4B85", letterSpacing: "0.16em" }}
        >
          Decision
        </span>
        {data.autoResolved && (
          <span
            title={data.autoResolved.reason}
            className="rounded-full px-1.5 py-[1px] font-mono text-[8.5px] font-semibold uppercase"
            style={{
              background: "var(--sage-deep)",
              color: "var(--cream)",
              letterSpacing: "0.12em",
            }}
          >
            Auto
          </span>
        )}
      </div>

      <div
        className="absolute left-0 right-0 px-3 text-center"
        style={{ top: diamondH + 8, opacity: onPath ? 1 : 0.32 }}
      >
        <div
          className="font-serif text-[14px] font-medium leading-snug"
          style={{ letterSpacing: "-0.01em" }}
        >
          {data.title}
        </div>
        {data.choices && (
          <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
            {data.choices.map((c) => {
              const isOn = data.selectedChoice === c.id;
              const yn = c.id.startsWith("yes") ? "yes" : c.id === "no" ? "no" : "";
              const onBg =
                yn === "yes" ? "var(--sage-deep)" : yn === "no" ? "var(--terracotta)" : "var(--charcoal)";
              return (
                <button
                  key={c.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFlowChoice(data.flowId, data.id, c.id);
                  }}
                  className="rounded-full border px-2 py-0.5 text-[10.5px] transition-transform hover:scale-105"
                  style={{
                    background: isOn ? onBg : "var(--cream)",
                    color: isOn ? "var(--cream)" : "var(--charcoal-soft)",
                    borderColor: isOn ? onBg : "rgba(148,139,130,.3)",
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const NODE_TYPES: NodeTypes = {
  pillNode: PillNode,
  rectNode: RectNode,
  diamondNode: DiamondNode,
};

// ─── Custom orthogonal edge ───────────────────────────────────────────
// React Flow's default `step` edge picks its bend at the source-target
// midpoint, which produces extra zigzags when the source exits a side
// handle. This edge routes:
//   • side exit → 1 bend at (targetX, sourceY): horizontal then vertical
//   • bottom exit, target column-shifted → 2 bends: down half, across, down
//   • bottom exit, target directly below → straight line
type OrthoEdgeData = { isActive?: boolean };

function OrthoEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  label,
  style,
  labelStyle,
}: EdgeProps<Edge<OrthoEdgeData>>) {
  let path: string;
  let labelX: number;
  let labelY: number;

  if (sourcePosition === Position.Left || sourcePosition === Position.Right) {
    // Side exit: out horizontally, then a single 90° bend down to the target.
    path = `M ${sourceX} ${sourceY} L ${targetX} ${sourceY} L ${targetX} ${targetY}`;
    labelX = (sourceX + targetX) / 2;
    labelY = sourceY;
  } else {
    // Bottom exit (default).
    if (Math.abs(sourceX - targetX) < 1) {
      path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
      labelX = (sourceX + targetX) / 2;
      labelY = (sourceY + targetY) / 2;
    } else {
      const midY = (sourceY + targetY) / 2;
      path = `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
      labelX = (sourceX + targetX) / 2;
      labelY = midY;
    }
  }

  return (
    <>
      <BaseEdge path={path} style={style} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: "#FDFBF7",
              padding: "2px 6px",
              borderRadius: 6,
              pointerEvents: "none",
              ...labelStyle,
            }}
            className="font-mono"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

const EDGE_TYPES: EdgeTypes = {
  ortho: OrthoEdge,
};
