"use client";

import { useEffect, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
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
import { Check, X, ExternalLink } from "lucide-react";

type NodeData = FlowNode & {
  flowId: string;
  isOnPath: boolean;
  isDone: boolean;
  selectedChoice?: string;
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
        <div
          className="absolute left-4 top-4 z-10 flex gap-1.5"
        >
          <button
            className="rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur"
            style={{
              background: "rgba(253,251,247,.92)",
              borderColor: "rgba(148,139,130,.2)",
              color: "var(--charcoal-soft)",
            }}
            data-flow-fit
            id="flow-fit-trigger"
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
  const { flowDone, flowChoices } = useTripStore();
  const rf = useReactFlow();

  const { nodes, edges } = useMemo(() => {
    const nodes: Node<NodeData>[] = flow.nodes.map((n) => ({
      id: n.id,
      type: n.kind === "start" ? "pillNode" : n.kind === "end" ? "pillNode" : "boxNode",
      position: { x: n.x, y: n.y },
      data: {
        ...n,
        flowId: flow.id,
        isOnPath: pathSet.has(n.id),
        isDone: !!flowDone[flow.id]?.[n.id],
        selectedChoice: flowChoices[flow.id]?.[n.id],
      },
      draggable: false,
      selectable: false,
    }));

    const edges: Edge[] = [];
    for (const n of flow.nodes) {
      if (n.choices) {
        for (const c of n.choices) {
          const isActive =
            pathSet.has(n.id) && (flowChoices[flow.id]?.[n.id] ?? c.on ? c.id : c.id) === c.id && pathSet.has(c.to);
          edges.push({
            id: `${n.id}-${c.id}`,
            source: n.id,
            target: c.to,
            label: c.label.split(" · ")[0],
            type: "smoothstep",
            animated: false,
            style: {
              stroke: isActive ? "#6E8068" : "#C9C2BB",
              strokeWidth: isActive ? 2.6 : 2,
              opacity: isActive ? 1 : 0.4,
            },
            labelStyle: {
              fontFamily: "var(--font-mono), monospace",
              fontSize: 11,
              fill: "#2C3033",
            },
            labelBgStyle: { fill: "#FDFBF7", opacity: 0.9 },
            labelBgPadding: [6, 3],
            labelBgBorderRadius: 6,
          });
        }
      } else if (n.next) {
        const isActive = pathSet.has(n.id) && pathSet.has(n.next);
        edges.push({
          id: `${n.id}-${n.next}`,
          source: n.id,
          target: n.next,
          type: "smoothstep",
          style: {
            stroke: isActive ? "#6E8068" : "#C9C2BB",
            strokeWidth: isActive ? 2.6 : 2,
            opacity: isActive ? 1 : 0.4,
          },
        });
      }
    }
    return { nodes, edges };
  }, [flow, pathSet, flowDone, flowChoices]);

  // Fit on first render and on demand via the toolbar button
  useEffect(() => {
    const t = setTimeout(() => rf.fitView({ padding: 0.18, duration: 320 }), 50);
    return () => clearTimeout(t);
  }, [rf, flow.id]);

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
          "radial-gradient(circle, rgba(148,139,130,.16) 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(180deg, var(--cream) 0%, #F8F4EC 100%)",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
      >
        <Background gap={24} size={1} color="rgba(148,139,130,0)" />
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
      className="rounded-full px-5 py-3.5 text-center shadow-sm"
      style={{
        width: data.w ?? 200,
        background: isStart
          ? "var(--charcoal)"
          : "linear-gradient(135deg, var(--sage-deep), var(--ocean))",
        color: "var(--cream)",
        border: "1.5px solid",
        borderColor: isStart ? "var(--charcoal)" : "var(--sage-deep)",
      }}
    >
      <div
        className="text-[10px] uppercase tracking-[0.12em]"
        style={{ color: "rgba(253,251,247,.6)" }}
      >
        {data.label}
      </div>
      <div className="mt-1 text-[13.5px] font-semibold">{data.title}</div>
      {!isStart && <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />}
      {isStart && <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />}
    </div>
  );
}

function BoxNode({ data }: NodeProps<Node<NodeData>>) {
  const { toggleFlowDone, setFlowChoice } = useTripStore();

  const bg =
    data.kind === "decision"
      ? "linear-gradient(180deg, #F5EFFB, var(--cream))"
      : data.kind === "action"
        ? "linear-gradient(180deg, #FBEDDF, var(--cream))"
        : data.kind === "info"
          ? "var(--sand)"
          : "var(--cream)";
  const border =
    data.kind === "decision"
      ? "rgba(184,168,216,.6)"
      : data.kind === "action"
        ? "rgba(192,120,86,.4)"
        : "rgba(148,139,130,.3)";

  return (
    <div
      className="relative rounded-2xl border-[1.5px] px-3.5 py-3 shadow-sm transition-shadow hover:shadow-md"
      style={{
        width: data.w ?? 240,
        background: bg,
        borderColor: data.isDone ? "rgba(139,157,131,.5)" : border,
        opacity: data.isOnPath ? 1 : 0.35,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />

      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFlowDone(data.flowId, data.id);
        }}
        className="absolute -left-2.5 -top-2.5 grid h-6 w-6 place-items-center rounded-full border-[1.5px] bg-cream transition-colors"
        style={{
          background: data.isDone ? "var(--sage-deep)" : "var(--cream)",
          color: data.isDone ? "var(--cream)" : "transparent",
          borderColor: data.isDone ? "var(--sage-deep)" : "var(--mocha-soft)",
        }}
        aria-label="Toggle done"
      >
        <Check className="h-3.5 w-3.5" />
      </button>

      {data.kind === "decision" && (
        <div
          className="absolute right-2.5 top-1.5 font-serif text-[22px] leading-none"
          style={{ color: "var(--lavender)" }}
        >
          ?
        </div>
      )}

      <div
        className="text-[10px] uppercase tracking-[0.12em]"
        style={{ color: "var(--mocha)" }}
      >
        {data.label}
      </div>
      <div className="mt-1 text-[13.5px] font-semibold leading-snug tracking-tight">
        {data.title}
      </div>
      {data.desc && (
        <div
          className="mt-1.5 text-[11.5px] leading-snug"
          style={{ color: "var(--charcoal-soft)" }}
        >
          {data.desc}
        </div>
      )}
      {data.meta && (
        <div
          className="mt-1.5 font-mono text-[10.5px]"
          style={{ color: "var(--mocha)" }}
        >
          {data.meta}
        </div>
      )}
      {data.link && (
        <a
          href={data.link.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]"
          style={{
            background: "var(--cream)",
            borderColor: "rgba(45,90,123,.25)",
            color: "var(--ocean)",
          }}
        >
          {data.link.label} <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {data.choices && (
        <div
          className="mt-2.5 flex flex-wrap gap-1.5 border-t border-dashed pt-2"
          style={{ borderColor: "rgba(148,139,130,.25)" }}
        >
          {data.choices.map((c) => {
            const isOn = data.selectedChoice === c.id;
            const yn = c.id.startsWith("yes") ? "yes" : c.id === "no" ? "no" : "";
            const onBg = yn === "yes" ? "var(--sage-deep)" : yn === "no" ? "var(--terracotta)" : "var(--charcoal)";
            return (
              <button
                key={c.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setFlowChoice(data.flowId, data.id, c.id);
                }}
                className="rounded-full border px-2.5 py-1 text-[11.5px] transition-transform hover:scale-105"
                style={{
                  background: isOn ? onBg : "var(--cream)",
                  color: isOn ? "var(--cream)" : "var(--charcoal-soft)",
                  borderColor: isOn ? onBg : "rgba(148,139,130,.25)",
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const NODE_TYPES: NodeTypes = {
  pillNode: PillNode,
  boxNode: BoxNode,
};
