"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import { TRIP, type Place } from "@/lib/trip-data";
import { useTripStore, type MapView } from "@/lib/use-trip-store";

type Route = { from: string; to: string; kind: "flight" | "transit"; label?: string };

type Props = {
  mapView: MapView;
  selectedDay: number;
  hoverPlaceId: string | null;
  activeItemId: string | null;
};

const TOKYO_VIEW: [number, number] = [35.5, 139.5];
const PACIFIC_VIEW: [number, number] = [38, -160];

export default function RouteMapInner({
  mapView,
  selectedDay,
  hoverPlaceId,
  activeItemId,
}: Props) {
  // Pick an initial center/zoom based on view
  const initial = useMemo<{ center: [number, number]; zoom: number }>(() => {
    if (mapView === "flights") return { center: PACIFIC_VIEW, zoom: 3 };
    return { center: TOKYO_VIEW, zoom: 6 };
  }, [mapView]);

  const routes = useMemo(() => buildRoutes(mapView, selectedDay), [mapView, selectedDay]);
  const placeIds = useMemo(() => pinsForView(mapView, selectedDay), [mapView, selectedDay]);

  return (
    <MapContainer
      center={initial.center}
      zoom={initial.zoom}
      scrollWheelZoom={true}
      style={{ width: "100%", height: "100%", background: "transparent" }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &middot; &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      <FitBounds placeIds={placeIds} mapView={mapView} />

      {routes.map((r, i) => (
        <RouteLine key={`${r.from}-${r.to}-${i}`} route={r} />
      ))}

      {placeIds.map((id) => (
        <Pin
          key={id}
          place={TRIP.places[id]}
          highlight={hoverPlaceId === id}
          flash={isActiveAtPlace(activeItemId, id)}
        />
      ))}
    </MapContainer>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────

function buildRoutes(view: MapView, dayIdx: number): Route[] {
  const r: Route[] = [];
  if (view === "flights" || view === "all") {
    r.push({ from: "SFO", to: "HND", kind: "flight", label: "NH107" });
    r.push({ from: "HND", to: "SFO", kind: "flight", label: "NH108" });
  }
  if (view === "all") {
    r.push({ from: "HND", to: "HAKO", kind: "transit" });
    r.push({ from: "HAKO", to: "KYO", kind: "transit" });
    r.push({ from: "KYO", to: "NARA", kind: "transit" });
    r.push({ from: "KYO", to: "HND", kind: "transit" });
  }
  if (view === "day") {
    const day = TRIP.days[dayIdx];
    const seq: string[] = [];
    for (const it of day.items) {
      if (it.placeId && seq[seq.length - 1] !== it.placeId) seq.push(it.placeId);
    }
    for (let i = 0; i < seq.length - 1; i++) {
      r.push({ from: seq[i], to: seq[i + 1], kind: "transit" });
    }
  }
  return r;
}

function pinsForView(view: MapView, dayIdx: number): string[] {
  if (view === "flights") return ["SFO", "HND"];
  if (view === "day") {
    const day = TRIP.days[dayIdx];
    return Array.from(new Set(day.items.map((it) => it.placeId).filter(Boolean) as string[]));
  }
  return Object.keys(TRIP.places);
}

function isActiveAtPlace(activeItemId: string | null, placeId: string) {
  if (!activeItemId) return false;
  for (const d of TRIP.days) {
    const it = d.items.find((x) => x.id === activeItemId);
    if (it) return it.placeId === placeId;
  }
  return false;
}

// ─── components ───────────────────────────────────────────────────────

function FitBounds({ placeIds, mapView }: { placeIds: string[]; mapView: MapView }) {
  const map = useMap();
  useEffect(() => {
    if (!placeIds.length) return;
    const points = placeIds
      .map((id) => TRIP.places[id])
      .filter(Boolean)
      .map((p) => [p.lat, p.lng] as [number, number]);
    if (mapView === "flights" || mapView === "all") {
      // include SFO + HND so the trans-Pacific arc fits
      const sfo = TRIP.places["SFO"];
      const hnd = TRIP.places["HND"];
      points.push([sfo.lat, sfo.lng], [hnd.lat, hnd.lng]);
    }
    if (points.length === 1) {
      map.setView(points[0], 8);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
  }, [placeIds, mapView, map]);
  return null;
}

function RouteLine({ route }: { route: Route }) {
  const a = TRIP.places[route.from];
  const b = TRIP.places[route.to];
  if (!a || !b) return null;

  if (route.kind === "flight") {
    // Curve a great-circle-ish arc: sample bezier control point above midpoint
    const points = greatCircleArc(a, b, 60);
    return (
      <Polyline
        positions={points}
        pathOptions={{
          color: "#2D5A7B",
          weight: 2,
          opacity: 0.85,
          dashArray: "6 6",
        }}
      >
        {route.label ? <Tooltip permanent direction="center" className="route-tip">{route.label}</Tooltip> : null}
      </Polyline>
    );
  }

  return (
    <Polyline
      positions={[
        [a.lat, a.lng],
        [b.lat, b.lng],
      ]}
      pathOptions={{ color: "#8B9D83", weight: 3, opacity: 0.75 }}
    />
  );
}

function Pin({ place, highlight, flash }: { place: Place; highlight: boolean; flash: boolean }) {
  const isAirport = place.kind === "airport";
  const color = isAirport
    ? "#2D5A7B"
    : place.id === "HAKO" || place.id === "KYO" || place.id === "NARA"
      ? "#C07856"
      : "#8B9D83";
  const radius = isAirport ? 9 : 7;

  return (
    <CircleMarker
      center={[place.lat, place.lng]}
      radius={highlight || flash ? radius + 4 : radius}
      pathOptions={{
        color,
        fillColor: "#FDFBF7",
        fillOpacity: 1,
        weight: 2.5,
        opacity: highlight ? 1 : 0.95,
      }}
    >
      <Tooltip
        permanent
        direction="top"
        offset={[0, -radius - 2]}
        className="pin-tip"
      >
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500 }}>
          {place.code ?? place.name}
        </span>
      </Tooltip>
    </CircleMarker>
  );
}

// Build an arc by sampling along a quadratic Bezier with a control point
// offset perpendicular to the great-circle midpoint. Good-enough visualization
// — not for navigation.
function greatCircleArc(a: Place, b: Place, samples: number): [number, number][] {
  const out: [number, number][] = [];
  const mx = (a.lat + b.lat) / 2;
  const my = (a.lng + b.lng) / 2;
  // Perpendicular offset proportional to span; bows northward toward Aleutians
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const offsetLat = mx + Math.min(28, dist * 0.18);
  const offsetLng = my;
  for (let t = 0; t <= 1; t += 1 / samples) {
    const oneMinus = 1 - t;
    const lat =
      oneMinus * oneMinus * a.lat +
      2 * oneMinus * t * offsetLat +
      t * t * b.lat;
    const lng =
      oneMinus * oneMinus * a.lng +
      2 * oneMinus * t * offsetLng +
      t * t * b.lng;
    out.push([lat, lng]);
  }
  return out;
}
