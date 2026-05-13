"use client";

import { TRIP, type ItemKind, type ItineraryItem, type TripDay } from "@/lib/trip-data";
import { useTripStore, activePath } from "@/lib/use-trip-store";
import { Plane, Building2, Sparkles, TrainFront, CircleCheck } from "lucide-react";
import { useMemo } from "react";

const ICON_BY_KIND: Record<ItemKind, React.ComponentType<{ className?: string }>> = {
  flight: Plane,
  hotel: Building2,
  activity: Sparkles,
  transit: TrainFront,
  checkpoint: CircleCheck,
};

const ICON_BG: Record<ItemKind, { bg: string; color: string; border: string }> = {
  flight: {
    bg: "linear-gradient(135deg, #EAF1F7, #DDE9F2)",
    color: "var(--ocean)",
    border: "rgba(45,90,123,.18)",
  },
  hotel: {
    bg: "linear-gradient(135deg, var(--lavender-soft), #D4C8E8)",
    color: "#5C4B85",
    border: "rgba(184,168,216,.4)",
  },
  activity: {
    bg: "linear-gradient(135deg, #F1E4D8, var(--sand))",
    color: "var(--terracotta)",
    border: "rgba(192,120,86,.22)",
  },
  transit: {
    bg: "linear-gradient(135deg, #E5EFE3, #D6E4D2)",
    color: "var(--sage-deep)",
    border: "rgba(139,157,131,.3)",
  },
  checkpoint: {
    bg: "var(--charcoal)",
    color: "var(--cream)",
    border: "var(--charcoal)",
  },
};

export function TimelinePanel() {
  const { selectedDay, selectDay } = useTripStore();

  return (
    <section
      className="overflow-hidden rounded-3xl border bg-cream shadow-md"
      style={{ borderColor: "rgba(148,139,130,.12)" }}
    >
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4.5">
        <div>
          <h2 className="font-serif text-xl font-medium tracking-tight">Itinerary</h2>
          <div className="mt-0.5 text-xs" style={{ color: "var(--mocha)" }}>
            {TRIP.days.length} days ·{" "}
            {TRIP.days.reduce((acc, d) => acc + d.items.length, 0)} stops
          </div>
        </div>
        <Segmented options={[{ id: "list", label: "Timeline" }, { id: "agenda", label: "Agenda" }]} />
      </div>

      <DayPicker selected={selectedDay} onSelect={selectDay} />

      <div className="relative px-5 pb-5 pt-1">
        {TRIP.days.map((d, di) => (
          <DaySection key={d.date} day={d} dayIndex={di} />
        ))}
      </div>
    </section>
  );
}

function Segmented({ options }: { options: { id: string; label: string }[] }) {
  return (
    <div
      className="inline-flex gap-0.5 rounded-full p-[3px]"
      style={{ background: "var(--sand)" }}
    >
      {options.map((o, i) => (
        <button
          key={o.id}
          className="rounded-full px-3 py-1 text-[12.5px] transition-colors"
          style={{
            background: i === 0 ? "var(--cream)" : "transparent",
            color: i === 0 ? "var(--charcoal)" : "var(--mocha)",
            boxShadow: i === 0 ? "0 1px 2px rgba(44,48,51,.04), 0 1px 3px rgba(44,48,51,.04)" : undefined,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DayPicker({ selected, onSelect }: { selected: number; onSelect: (i: number) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto px-5 pb-3.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TRIP.days.map((d, i) => {
        const dots = d.items
          .map((it) =>
            it.kind === "flight" ? "f" : it.kind === "hotel" ? "h" : it.kind === "activity" ? "a" : ""
          )
          .filter(Boolean);
        const on = i === selected;
        return (
          <button
            key={d.date}
            onClick={() => onSelect(i)}
            className="flex min-w-[56px] flex-col items-center rounded-2xl border px-2 py-2.5 transition-colors"
            style={{
              background: on ? "var(--charcoal)" : "transparent",
              borderColor: on ? "var(--charcoal)" : "transparent",
            }}
          >
            <div
              className="text-[10px] uppercase tracking-[0.1em]"
              style={{ color: on ? "var(--cream)" : "var(--mocha)" }}
            >
              {d.dow}
            </div>
            <div
              className="mt-0.5 font-serif text-xl font-medium"
              style={{ color: on ? "var(--cream)" : "var(--charcoal)" }}
            >
              {d.num}
            </div>
            <div className="mt-1.5 flex min-h-[4px] gap-[3px]">
              {dots.map((c, j) => (
                <span
                  key={j}
                  className="h-1 w-1 rounded-full"
                  style={{
                    background:
                      c === "f"
                        ? on
                          ? "var(--terracotta-soft)"
                          : "var(--ocean)"
                        : c === "h"
                          ? on
                            ? "rgba(253,251,247,.4)"
                            : "var(--lavender)"
                          : on
                            ? "rgba(253,251,247,.4)"
                            : "var(--terracotta)",
                  }}
                />
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DaySection({ day, dayIndex }: { day: TripDay; dayIndex: number }) {
  return (
    <>
      <div
        className="flex items-baseline justify-between border-t border-dashed pb-3.5 pt-2.5 first:mt-0 first:border-t-0 first:pt-1"
        style={{ borderColor: "rgba(148,139,130,.2)" }}
      >
        <div>
          <div
            className="text-[11px] uppercase tracking-[0.1em]"
            style={{ color: "var(--mocha)" }}
          >
            {day.dow.toUpperCase()} · {formatMD(day.date)}
          </div>
          <div className="font-serif text-[16px] font-medium">{day.where}</div>
        </div>
        <span
          className="rounded-full border px-3 py-1 text-[11px]"
          style={{
            background: "var(--sand)",
            borderColor: "rgba(148,139,130,.10)",
            color: "var(--charcoal-soft)",
          }}
        >
          {day.items.length} stops
        </span>
      </div>

      {day.items.map((it) => (
        <TimelineItem key={it.id} item={it} dayIndex={dayIndex} />
      ))}
    </>
  );
}

function TimelineItem({ item, dayIndex }: { item: ItineraryItem; dayIndex: number }) {
  const { activeItemId, setActiveItem, hoverPlace, openFlow, selectDay } = useTripStore();
  const Icon = ICON_BY_KIND[item.kind];
  const iconStyle = ICON_BG[item.kind];
  const isActive = activeItemId === item.id;

  return (
    <div className="relative grid grid-cols-[44px_1fr] gap-3 py-1">
      <div className="tl-line" />
      <div
        className="z-10 grid h-11 w-11 place-items-center rounded-2xl border shadow-sm"
        style={{
          background: iconStyle.bg,
          color: iconStyle.color,
          borderColor: iconStyle.border,
        }}
      >
        <Icon className="h-[18px] w-[18px]" />
      </div>

      {item.kind === "checkpoint" ? (
        <CheckpointCard item={item} />
      ) : (
        <button
          onClick={() => {
            setActiveItem(item.id);
            selectDay(dayIndex);
          }}
          onMouseEnter={() => hoverPlace(item.placeId ?? null)}
          onMouseLeave={() => hoverPlace(null)}
          className="mb-2 cursor-pointer rounded-xl border bg-cream p-3.5 text-left transition-all hover:-translate-y-px hover:shadow-md"
          style={{
            borderColor: isActive ? "var(--sage)" : "rgba(148,139,130,.12)",
            boxShadow: isActive
              ? "0 0 0 3px rgba(139,157,131,.15), 0 2px 8px rgba(44,48,51,.06), 0 4px 16px rgba(44,48,51,.04)"
              : undefined,
          }}
        >
          <div className="mb-1 flex items-baseline justify-between gap-2.5">
            <div className="text-[14.5px] font-semibold tracking-tight">{item.title}</div>
            <div className="font-mono text-[11.5px]" style={{ color: "var(--mocha)" }}>
              {item.time}
            </div>
          </div>
          <div
            className="flex flex-wrap items-center gap-2 text-[12.5px]"
            style={{ color: "var(--mocha)" }}
          >
            <span>{item.sub}</span>
            {item.badges?.length ? (
              <>
                <span className="grow" />
                {item.badges.map((b) => {
                  const lower = b.toLowerCase();
                  const isOk = lower.includes("book") || lower.includes("confirm") || lower.includes("pass");
                  return (
                    <span
                      key={b}
                      className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        background: isOk ? "#E8EFE6" : "var(--sand)",
                        color: isOk ? "var(--sage-deep)" : "var(--charcoal-soft)",
                        borderColor: isOk ? "rgba(139,157,131,.3)" : "rgba(148,139,130,.16)",
                      }}
                    >
                      {b}
                    </span>
                  );
                })}
              </>
            ) : null}
          </div>
        </button>
      )}
    </div>
  );
}

function CheckpointCard({ item }: { item: ItineraryItem }) {
  const { flowDone, flowChoices, openFlow } = useTripStore();

  const { pct, done, total } = useMemo(() => {
    if (!item.flowId) return { pct: 0, done: 0, total: 0 };
    const flow = TRIP.flows[item.flowId];
    if (!flow) return { pct: 0, done: 0, total: 0 };
    const path = activePath(item.flowId, flowChoices[item.flowId] ?? {});
    const nodeMap = Object.fromEntries(flow.nodes.map((n) => [n.id, n]));
    let d = 0;
    let t = 0;
    for (const id of path) {
      const n = nodeMap[id];
      if (!n || n.kind === "start" || n.kind === "end") continue;
      t += 1;
      if (flowDone[item.flowId]?.[n.id]) d += 1;
    }
    return { pct: t ? Math.round((d * 100) / t) : 0, done: d, total: t };
  }, [item.flowId, flowDone, flowChoices]);

  return (
    <button
      onClick={() => item.flowId && openFlow(item.flowId)}
      className="relative mb-2 cursor-pointer overflow-hidden rounded-xl border p-3.5 text-left shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-lg)]"
      style={{
        background: "var(--grad-checkpoint)",
        color: "var(--cream)",
        borderColor: "var(--charcoal)",
      }}
    >
      <div
        aria-hidden
        className="absolute -right-5 -top-7 h-[120px] w-[120px]"
        style={{ background: "radial-gradient(circle, rgba(184,168,216,.3), transparent 70%)" }}
      />
      <div className="relative mb-1 flex items-baseline justify-between gap-2.5">
        <div className="text-[14.5px] font-semibold">{item.title}</div>
        <div className="font-mono text-[11.5px]" style={{ color: "rgba(253,251,247,.6)" }}>
          {done}/{total}
        </div>
      </div>
      <div
        className="relative flex flex-wrap items-center gap-2 text-[12.5px]"
        style={{ color: "rgba(253,251,247,.7)" }}
      >
        <span>{item.sub}</span>
        <span className="grow" />
        <span
          className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
          style={{
            background: "rgba(253,251,247,.12)",
            color: "var(--cream)",
            borderColor: "rgba(253,251,247,.2)",
          }}
        >
          Open flowchart →
        </span>
      </div>
      <div
        className="relative mt-2.5 h-1 overflow-hidden rounded-full"
        style={{ background: "rgba(253,251,247,.15)" }}
      >
        <span
          className="block h-full rounded-full transition-[width]"
          style={{ width: `${pct}%`, background: "var(--terracotta-soft)" }}
        />
      </div>
    </button>
  );
}

function formatMD(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
