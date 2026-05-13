"use client";

import dynamic from "next/dynamic";
import { useTripStore } from "@/lib/use-trip-store";
import { TRIP } from "@/lib/trip-data";
import { useMemo } from "react";

const MapInner = dynamic(() => import("./route-map-inner"), { ssr: false });

export function RouteMap() {
  const { mapView, setMapView, selectedDay, hoverPlaceId, activeItemId } = useTripStore();
  const day = TRIP.days[selectedDay];

  const subtitle = useMemo(() => {
    if (mapView === "flights") return "Long-haul flights · SFO ⇄ HND";
    if (mapView === "day") return `Day ${day.num} · ${day.where}`;
    return "Showing all 9 days · Tokyo + Kansai";
  }, [mapView, day]);

  const selected = useMemo(() => {
    for (const d of TRIP.days) {
      const it = d.items.find((x) => x.id === activeItemId);
      if (it) return it;
    }
    return null;
  }, [activeItemId]);

  return (
    <section
      className="sticky top-[76px] flex max-h-[calc(100vh-92px)] min-h-[640px] flex-col overflow-hidden rounded-3xl border bg-cream shadow-md"
      style={{ borderColor: "rgba(148,139,130,.12)" }}
    >
      <div className="flex items-center justify-between gap-3 px-5 pb-2.5 pt-4.5">
        <div>
          <h2 className="font-serif text-xl font-medium tracking-tight">Route map</h2>
          <div className="mt-0.5 text-xs" style={{ color: "var(--mocha)" }}>
            {subtitle}
          </div>
        </div>
        <div
          className="inline-flex gap-0.5 rounded-full p-[3px]"
          style={{ background: "var(--sand)" }}
        >
          {[
            { id: "all", label: "All days" },
            { id: "day", label: "Selected day" },
            { id: "flights", label: "Flights only" },
          ].map((opt) => {
            const on = mapView === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setMapView(opt.id as typeof mapView)}
                className="rounded-full px-3 py-1 text-[12.5px] transition-colors"
                style={{
                  background: on ? "var(--cream)" : "transparent",
                  color: on ? "var(--charcoal)" : "var(--mocha)",
                  boxShadow: on ? "0 1px 2px rgba(44,48,51,.04), 0 1px 3px rgba(44,48,51,.04)" : undefined,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="relative flex-1 overflow-hidden border-t"
        style={{
          borderColor: "rgba(148,139,130,.10)",
          background: "var(--sand)",
        }}
      >
        <MapInner
          mapView={mapView}
          selectedDay={selectedDay}
          hoverPlaceId={hoverPlaceId}
          activeItemId={activeItemId}
        />

        <div
          className="absolute left-4 top-4 max-w-[260px] rounded-xl border px-3 py-2.5 text-xs shadow-sm backdrop-blur"
          style={{
            background: "var(--cream)",
            borderColor: "rgba(148,139,130,.18)",
          }}
        >
          <div
            className="text-[10px] uppercase tracking-[0.08em]"
            style={{ color: "var(--mocha)" }}
          >
            Selected
          </div>
          <div className="mt-0.5 font-serif text-[16px]">
            {selected ? selected.title : "All stops · Japan"}
          </div>
          <div className="mt-1 text-[11.5px]" style={{ color: "var(--mocha)" }}>
            {selected ? selected.sub : "Hover or tap an item in the timeline to focus."}
          </div>
        </div>

        <div
          className="absolute bottom-4 right-4 grid gap-1.5 rounded-xl border px-3 py-2.5 text-[11.5px] shadow-sm backdrop-blur"
          style={{
            background: "var(--cream)",
            borderColor: "rgba(148,139,130,.18)",
          }}
        >
          <Legend swatch="var(--ocean)" label="Flight" />
          <Legend swatch="var(--sage)" label="Train / transit" h={3} />
          <Legend swatch="var(--lavender)" label="Hotel" />
          <Legend swatch="var(--terracotta)" label="Activity" />
          <div
            className="mt-1 border-t pt-1.5 font-mono text-[10px]"
            style={{ borderColor: "rgba(148,139,130,.18)", color: "var(--mocha)" }}
          >
            ⌖ Leaflet · OpenStreetMap
          </div>
        </div>
      </div>
    </section>
  );
}

function Legend({ swatch, label, h = 8 }: { swatch: string; label: string; h?: number }) {
  return (
    <div
      className="flex items-center gap-2"
      style={{ color: "var(--charcoal-soft)" }}
    >
      <div className="w-3.5 rounded" style={{ background: swatch, height: h }} />
      {label}
    </div>
  );
}
