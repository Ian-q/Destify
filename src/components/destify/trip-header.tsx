"use client";

import { TRIP, type FlowGraph } from "@/lib/trip-data";
import { useTripStore, activePath } from "@/lib/use-trip-store";
import { useMemo } from "react";

export function TripHeader() {
  const { flowDone, flowChoices, openFlow } = useTripStore();

  // Build readiness from the primary preflight flow
  const { pct, doneCount, totalCount } = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const flow of Object.values(TRIP.flows) as FlowGraph[]) {
      const path = activePath(flow.id, flowChoices[flow.id] ?? {});
      const nodeMap = Object.fromEntries(flow.nodes.map((n) => [n.id, n]));
      for (const id of path) {
        const n = nodeMap[id];
        if (!n || n.kind === "start" || n.kind === "end") continue;
        total += 1;
        if (flowDone[flow.id]?.[n.id]) done += 1;
      }
    }
    return { pct: total ? Math.round((done * 100) / total) : 0, doneCount: done, totalCount: total };
  }, [flowDone, flowChoices]);

  const dateRange = `${formatDate(TRIP.start)} → ${formatDate(TRIP.end)}, ${new Date(TRIP.end).getFullYear()}`;
  const nights = Math.round(
    (new Date(TRIP.end).getTime() - new Date(TRIP.start).getTime()) / (24 * 60 * 60 * 1000)
  );

  return (
    <section className="flex flex-wrap items-end justify-between gap-6 px-8 pb-4 pt-7">
      <div>
        <div
          className="mb-2 flex items-center gap-3 text-sm"
          style={{ color: "var(--mocha)" }}
        >
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px]"
            style={{
              background: "var(--sand)",
              borderColor: "rgba(148,139,130,.10)",
              color: "var(--charcoal-soft)",
            }}
          >
            {TRIP.fromFlag} → {TRIP.toFlag}
          </span>
          <span>{dateRange}</span>
          <span className="h-[3px] w-[3px] rounded-full" style={{ background: "var(--mocha-soft)" }} />
          <span>{nights} nights</span>
          <span className="h-[3px] w-[3px] rounded-full" style={{ background: "var(--mocha-soft)" }} />
          <span>{TRIP.travelers} travelers</span>
        </div>
        <h1
          className="font-serif text-[44px] font-medium leading-[1.05] tracking-tight"
          style={{ margin: 0 }}
        >
          {splitTitle(TRIP.title)}
        </h1>
        <div className="mt-2 text-sm" style={{ color: "var(--mocha)" }}>
          {TRIP.routeSummary}
        </div>
      </div>

      <div
        className="min-w-[280px] rounded-xl border bg-cream px-4 py-3.5 shadow-sm"
        style={{ borderColor: "rgba(148,139,130,.14)" }}
      >
        <div className="flex items-baseline justify-between">
          <span
            className="text-[12px] uppercase tracking-[0.08em]"
            style={{ color: "var(--mocha)" }}
          >
            Trip readiness
          </span>
          <span className="font-serif text-[22px] font-medium">{pct}%</span>
        </div>
        <div
          className="mt-2.5 h-1.5 overflow-hidden rounded-full"
          style={{ background: "var(--sand)" }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-400"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, var(--sage), var(--sage-deep))",
            }}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-xs" style={{ color: "var(--mocha)" }}>
            {doneCount} of {totalCount} checklist items complete
          </span>
          <button
            onClick={() => openFlow("preflight-jp")}
            className="text-xs"
            style={{ color: "var(--ocean)" }}
          >
            Resume →
          </button>
        </div>
      </div>
    </section>
  );
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Italicize the last word for the "Tokyo, slowly." treatment
function splitTitle(title: string) {
  const m = title.match(/^(.*?)([A-Za-z]+)([.!?])?$/);
  if (!m) return title;
  const [, head, last, punct] = m;
  return (
    <>
      {head}
      <em
        style={{ fontStyle: "italic", color: "var(--terracotta)" }}
      >
        {last}
      </em>
      {punct ?? ""}
    </>
  );
}
