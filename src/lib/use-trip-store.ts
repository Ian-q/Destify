"use client";

import { create } from "zustand";
import { TRIP, type DocState, type FlowNode, type FlowChoice } from "@/lib/trip-data";

type FlowState = Record<string, boolean>; // node-id -> done?
type FlowChoiceState = Record<string, string>; // node-id -> chosen choice id

export type MapView = "all" | "day" | "flights";

type State = {
  selectedDay: number;
  activeItemId: string | null;
  hoverPlaceId: string | null;
  mapView: MapView;
  flowOpen: string | null; // open flow id
  docs: Record<string, DocState>;
  flowDone: Record<string, FlowState>; // flow id -> node done map
  flowChoices: Record<string, FlowChoiceState>; // flow id -> choices
  flowResolved: Record<string, Record<string, { choiceId: string; ruleId: string; reason: string }>>;
  flowOverrides: Record<string, Record<string, string>>;
};

type Actions = {
  selectDay: (i: number) => void;
  setActiveItem: (id: string | null) => void;
  hoverPlace: (id: string | null) => void;
  setMapView: (v: MapView) => void;
  openFlow: (id: string) => void;
  closeFlow: () => void;
  toggleDoc: (id: string) => void;
  toggleFlowDone: (flowId: string, nodeId: string) => void;
  setFlowChoice: (flowId: string, nodeId: string, choiceId: string) => void;
  resetFlowChoices: (flowId: string) => void;
  applyResolution: (flowId: string, output: Record<string, { choiceId: string; ruleId: string; reason: string }>) => void;
};

const initialDocs = Object.fromEntries(TRIP.docs.map((d) => [d.id, d.state]));
const initialFlowDone: Record<string, FlowState> = {};
const initialFlowChoices: Record<string, FlowChoiceState> = {};
for (const [fid, flow] of Object.entries(TRIP.flows)) {
  initialFlowDone[fid] = Object.fromEntries(flow.nodes.map((n) => [n.id, !!n.done]));
  initialFlowChoices[fid] = Object.fromEntries(
    flow.nodes
      .filter((n) => n.choices)
      .map((n) => {
        const on = n.choices!.find((c) => c.on);
        return [n.id, on ? on.id : n.choices![0].id];
      })
  );
}

export const useTripStore = create<State & Actions>((set) => ({
  selectedDay: 1,
  activeItemId: null,
  hoverPlaceId: null,
  mapView: "all",
  flowOpen: null,
  docs: initialDocs,
  flowDone: initialFlowDone,
  flowChoices: initialFlowChoices,
  flowResolved: {},
  flowOverrides: {},

  selectDay: (i) => set({ selectedDay: i }),
  setActiveItem: (id) => set({ activeItemId: id }),
  hoverPlace: (id) => set({ hoverPlaceId: id }),
  setMapView: (v) => set({ mapView: v }),
  openFlow: (id) => set({ flowOpen: id }),
  closeFlow: () => set({ flowOpen: null }),

  toggleDoc: (id) =>
    set((s) => {
      const cur = s.docs[id];
      if (cur === "skipped") return s;
      return { docs: { ...s.docs, [id]: cur === "done" ? "warn" : "done" } };
    }),

  toggleFlowDone: (flowId, nodeId) =>
    set((s) => ({
      flowDone: {
        ...s.flowDone,
        [flowId]: { ...s.flowDone[flowId], [nodeId]: !s.flowDone[flowId]?.[nodeId] },
      },
    })),

  setFlowChoice: (flowId, nodeId, choiceId) =>
    set((s) => ({
      flowChoices: {
        ...s.flowChoices,
        [flowId]: { ...s.flowChoices[flowId], [nodeId]: choiceId },
      },
    })),

  resetFlowChoices: (flowId) =>
    set((s) => {
      const flow = TRIP.flows[flowId];
      if (!flow) return s;
      const reset: FlowChoiceState = {};
      for (const n of flow.nodes) {
        if (n.choices) {
          const def = n.choices.find((c) => c.on) || n.choices[0];
          reset[n.id] = def.id;
        }
      }
      return { flowChoices: { ...s.flowChoices, [flowId]: reset } };
    }),

  applyResolution: (flowId, output) =>
    set((s) => {
      const overrides = s.flowOverrides[flowId] ?? {};
      const newFlowChoices = { ...s.flowChoices };
      const flowSpecificChoices = { ...(newFlowChoices[flowId] ?? {}) };
      for (const [nodeId, resolved] of Object.entries(output)) {
        flowSpecificChoices[nodeId] = overrides[nodeId] ?? resolved.choiceId;
      }
      newFlowChoices[flowId] = flowSpecificChoices;
      return {
        flowChoices: newFlowChoices,
        flowResolved: { ...s.flowResolved, [flowId]: output },
      };
    }),
}));

// Walk the active path of a flow given current choices.
export function activePath(flowId: string, choicesByNode: FlowChoiceState): string[] {
  const flow = TRIP.flows[flowId];
  if (!flow) return [];
  const nodeMap: Record<string, FlowNode> = Object.fromEntries(
    flow.nodes.map((n) => [n.id, n])
  );
  const visited = new Set<string>();
  const path: string[] = [];
  let id: string | undefined = flow.startId;
  while (id && !visited.has(id)) {
    visited.add(id);
    path.push(id);
    const node: FlowNode | undefined = nodeMap[id];
    if (!node) break;
    if (node.kind === "end") break;
    if (node.choices && node.choices.length) {
      const choiceId = choicesByNode[node.id];
      const choice: FlowChoice =
        node.choices.find((c: FlowChoice) => c.id === choiceId) ?? node.choices[0];
      id = choice.to;
    } else {
      id = node.next;
    }
  }
  return path;
}
