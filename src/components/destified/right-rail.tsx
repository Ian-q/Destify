"use client";

import { TRIP, type DocItem, type Hotel } from "@/lib/trip-data";
import { useTripStore } from "@/lib/use-trip-store";
import { toast } from "@/components/destified/toast";
import { Check, AlertTriangle, ArrowRight, ExternalLink } from "lucide-react";

export function RightRail() {
  return (
    <aside className="grid gap-4.5">
      <BudgetCard />
      <ChecklistCard />
      <StaysCard />
    </aside>
  );
}

function PanelShell({
  title,
  sub,
  right,
  children,
}: {
  title: string;
  sub: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="overflow-hidden rounded-3xl border bg-cream shadow-md"
      style={{ borderColor: "rgba(148,139,130,.12)" }}
    >
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4.5">
        <div>
          <h2 className="font-serif text-xl font-medium tracking-tight">{title}</h2>
          <div className="mt-0.5 text-xs" style={{ color: "var(--mocha)" }}>
            {sub}
          </div>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function BudgetCard() {
  const stats = [
    { k: "Remaining", v: `$${(TRIP.budget - TRIP.spent).toLocaleString()}`, delta: "↓ on track", bg: "linear-gradient(135deg, var(--lavender-soft), #E8DFF2)" },
    { k: "Flights", v: "$2,140", delta: "2 booked", bg: "linear-gradient(135deg, #EAF1F7, #DDE9F2)" },
    { k: "Stays", v: "$1,820", delta: "3 of 3 set", bg: "linear-gradient(135deg, var(--sand), #ECDFC8)" },
    { k: "Activities", v: "$640", delta: "+ JR pass $400", bg: "linear-gradient(135deg, #F1E4D8, #E8D5C2)" },
  ];
  return (
    <PanelShell
      title="Budget"
      sub={`$${TRIP.spent.toLocaleString()} of $${TRIP.budget.toLocaleString()} planned`}
      right={
        <div className="inline-flex gap-0.5 rounded-full p-[3px]" style={{ background: "var(--sand)" }}>
          {["USD", "JPY"].map((c, i) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                if (i !== 0) toast("Currency conversion — coming soon");
              }}
              className="rounded-full px-3 py-1 text-[12.5px]"
              style={{
                background: i === 0 ? "var(--cream)" : "transparent",
                color: i === 0 ? "var(--charcoal)" : "var(--mocha)",
                cursor: i === 0 ? "default" : "pointer",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2.5 px-5 pb-4.5">
        {stats.map((s) => (
          <div
            key={s.k}
            className="rounded-2xl px-3.5 py-3"
            style={{ background: s.bg }}
          >
            <div
              className="text-[10.5px] uppercase tracking-[0.1em]"
              style={{ color: "var(--mocha)" }}
            >
              {s.k}
            </div>
            <div className="mt-0.5 font-serif text-[22px] font-medium tracking-tight">
              {s.v}
            </div>
            <div
              className="mt-0.5 font-mono text-[11px]"
              style={{ color: "var(--sage-deep)" }}
            >
              {s.delta}
            </div>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function ChecklistCard() {
  const { docs, toggleDoc, openFlow } = useTripStore();
  return (
    <PanelShell
      title="Pre-flight checklist"
      sub="USA → Japan · Domestic re-entry covered"
      right={
        <button
          onClick={() => openFlow("preflight-jp")}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium"
          style={{ background: "var(--charcoal)", color: "var(--cream)" }}
        >
          Open flowchart <ArrowRight className="h-3.5 w-3.5" />
        </button>
      }
    >
      <div className="grid gap-2 px-5 pb-4">
        {TRIP.docs.map((d) => (
          <DocRow key={d.id} doc={d} state={docs[d.id]} onClick={() => toggleDoc(d.id)} />
        ))}
      </div>
    </PanelShell>
  );
}

function DocRow({
  doc,
  state,
  onClick,
}: {
  doc: DocItem;
  state: string;
  onClick: () => void;
}) {
  const isDone = state === "done";
  const isWarn = state === "warn";
  const tickStyle = isDone
    ? { background: "var(--sage-deep)", color: "var(--cream)", borderColor: "var(--sage-deep)" }
    : isWarn
      ? { background: "var(--terracotta)", color: "var(--cream)", borderColor: "var(--terracotta)" }
      : { background: "var(--sand)", color: "transparent", borderColor: "rgba(148,139,130,.2)" };
  return (
    <div
      className="flex items-stretch overflow-hidden rounded-2xl border bg-cream"
      style={{ borderColor: "rgba(148,139,130,.14)" }}
    >
      <button
        onClick={onClick}
        className="flex flex-1 items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:[background:var(--cream-warm)]"
      >
        <div
          className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border"
          style={tickStyle}
        >
          {isDone ? <Check className="h-3.5 w-3.5" /> : isWarn ? <AlertTriangle className="h-3 w-3" /> : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{doc.title}</div>
          <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--mocha)" }}>
            {doc.sub}
          </div>
        </div>
      </button>
      {doc.link ? (
        <a
          href={doc.link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex shrink-0 items-center gap-1.5 border-l px-3.5 text-[11.5px] font-medium transition-colors hover:bg-[var(--ocean)] hover:text-[var(--cream)]"
          style={{
            background: "#ECE4D6",
            borderLeftColor: "rgba(148,139,130,.16)",
            color: "var(--ocean)",
          }}
        >
          <span>{doc.link.label}</span>
          <ExternalLink className="h-3 w-3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
        </a>
      ) : null}
    </div>
  );
}

function StaysCard() {
  return (
    <PanelShell
      title="Stays"
      sub="Within budget · ranked by walk score"
      right={
        <div className="inline-flex gap-0.5 rounded-full p-[3px]" style={{ background: "var(--sand)" }}>
          {["Picked", "Alts"].map((c, i) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                if (i !== 0) toast("Alternative stays — coming soon");
              }}
              className="rounded-full px-3 py-1 text-[12.5px]"
              style={{
                background: i === 0 ? "var(--cream)" : "transparent",
                color: i === 0 ? "var(--charcoal)" : "var(--mocha)",
                cursor: i === 0 ? "default" : "pointer",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid gap-2.5 px-5 pb-4.5">
        {TRIP.hotels.map((h) => (
          <HotelRow key={h.id} hotel={h} />
        ))}
      </div>
    </PanelShell>
  );
}

function HotelRow({ hotel }: { hotel: Hotel }) {
  const swatchBg =
    hotel.swatch === "lavender"
      ? "repeating-linear-gradient(45deg, #D4C8E8 0px, #D4C8E8 8px, var(--lavender-soft) 8px, var(--lavender-soft) 16px)"
      : hotel.swatch === "ocean"
        ? "repeating-linear-gradient(45deg, #C5D6E2 0px, #C5D6E2 8px, #DDE9F2 8px, #DDE9F2 16px)"
        : "repeating-linear-gradient(45deg, var(--sand-deep) 0px, var(--sand-deep) 8px, var(--sand) 8px, var(--sand) 16px)";
  return (
    <div
      className="grid grid-cols-[80px_1fr] gap-3 rounded-2xl border p-2.5 transition-shadow hover:shadow-sm"
      style={{
        borderColor: hotel.picked ? "var(--sage)" : "rgba(148,139,130,.14)",
        background: hotel.picked ? "#F4F7F2" : undefined,
      }}
    >
      <div
        className="relative h-20 w-20 overflow-hidden rounded-md"
        style={{ background: swatchBg }}
      >
        <span
          className="absolute bottom-1 left-1.5 font-mono text-[9px]"
          style={{ color: "rgba(44,48,51,.5)" }}
        >
          {hotel.code}
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold">{hotel.name}</div>
        <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--mocha)" }}>
          {hotel.area}
        </div>
        <div className="mt-1.5 flex items-baseline justify-between">
          <div className="font-serif text-[16px] font-medium">
            ${hotel.price}
            <small
              className="ml-1 text-[10.5px] font-normal"
              style={{ color: "var(--mocha)", fontFamily: "var(--font-sans)" }}
            >
              /night · {hotel.nights}n
            </small>
          </div>
          <div className="text-[11px]" style={{ color: "var(--terracotta)", letterSpacing: "1px" }}>
            ★ {hotel.stars}
          </div>
        </div>
      </div>
    </div>
  );
}
