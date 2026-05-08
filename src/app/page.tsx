"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, CheckSquare2, Map, Sparkles } from "lucide-react";

// 0 = initial hidden
// 1 = words visible
// 2 = converging
// 3 = destify visible
// 4 = hero content revealed
type Phase = 0 | 1 | 2 | 3 | 4;

const CITIES = [
  {
    name: "Tokyo", country: "Japan", italic: false,
    img: "photo-1540959733332-eab4deabeeaf",
    fallback: "#1a1f2e",
  },
  {
    name: "Paris", country: "France", italic: true,
    img: "photo-1502602898657-3e91760cbb34",
    fallback: "#2e2416",
  },
  {
    name: "Bali", country: "Indonesia", italic: false,
    img: "photo-1537996194471-e657df975ab4",
    fallback: "#1a2e1e",
  },
  {
    name: "New York", country: "USA", italic: true,
    img: "photo-1496442226666-8d4d0e62e6e9",
    fallback: "#1a1a24",
  },
  {
    name: "Santorini", country: "Greece", italic: false,
    img: "photo-1570077188670-e3a8d69ac5ff",
    fallback: "#1a2535",
  },
];

const IMG_DURATION = 900; // ms each city is shown
const IMGS_END = IMG_DURATION * CITIES.length; // 4500ms

export default function LandingPage() {
  const [phase, setPhase] = useState<Phase>(0);
  const [imgIdx, setImgIdx]     = useState(0);
  const [imgVisible, setImgVisible] = useState(true);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // Cycle through city images
    CITIES.forEach((_, i) => {
      timers.push(setTimeout(() => setImgIdx(i), i * IMG_DURATION));
    });

    // Fade out images, reveal cream background
    timers.push(setTimeout(() => setImgVisible(false), IMGS_END + 200));

    // Main animation phases
    timers.push(setTimeout(() => setPhase(1), IMGS_END + 900));
    timers.push(setTimeout(() => setPhase(2), IMGS_END + 3200));
    timers.push(setTimeout(() => setPhase(3), IMGS_END + 3900));
    timers.push(setTimeout(() => setPhase(4), IMGS_END + 5000));

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <>
      <style>{`
        @keyframes destify-bloom {
          0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.42); filter: blur(6px); }
          55%  { opacity: 1; transform: translate(-50%, -50%) scale(1.04); filter: blur(0px); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1);    filter: blur(0px); }
        }
        @keyframes ring-out {
          0%   { transform: translate(-50%, -50%) scale(0.5); opacity: 0.5; }
          100% { transform: translate(-50%, -50%) scale(2.4); opacity: 0;   }
        }
        @keyframes scroll-bob {
          0%, 100% { transform: translateY(0);   opacity: 0.45; }
          50%       { transform: translateY(7px); opacity: 0.7;  }
        }
      `}</style>

      {/* ── Floating nav (appears after animation) ───────────────────── */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          height: 58,
          background: "rgba(253,251,247,.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(148,139,130,.1)",
          opacity: phase >= 4 ? 1 : 0,
          transform: phase >= 4 ? "translateY(0)" : "translateY(-8px)",
          transition: "opacity 0.7s ease, transform 0.7s ease",
          pointerEvents: phase >= 4 ? "auto" : "none",
        }}
      >
        <div style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: "var(--charcoal)",
        }}>
          Dest<em style={{ fontStyle: "italic", color: "var(--sage-deep)" }}>ify</em>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link
            href="/login"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--mocha)",
              textDecoration: "none",
              padding: "8px 14px",
              borderRadius: 999,
              letterSpacing: "-0.01em",
              transition: "color 0.2s ease",
            }}
          >
            Sign in
          </Link>
          <Link
            href="/login"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "linear-gradient(135deg, var(--sage) 0%, var(--ocean) 100%)",
              color: "var(--cream)",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 500,
              padding: "8px 18px",
              borderRadius: 999,
              textDecoration: "none",
              letterSpacing: "-0.01em",
              boxShadow: "0 2px 12px rgba(45,90,123,.18)",
            }}
          >
            Sign up
            <ArrowRight size={12} />
          </Link>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100svh",
          overflow: "hidden",
          background:
            "radial-gradient(900px 500px at 72% 15%, rgba(184,168,216,.11), transparent 60%)," +
            "radial-gradient(600px 400px at 12% 72%, rgba(192,120,86,.08), transparent 60%)," +
            "linear-gradient(180deg, var(--cream-warm) 0%, var(--cream) 100%)",
        }}
      >
        {/* ── City photo slideshow ─────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            opacity: imgVisible ? 1 : 0,
            transition: "opacity 0.95s ease",
            pointerEvents: "none",
          }}
        >
          {/* City background images */}
          {CITIES.map((city, i) => (
            <div
              key={city.name}
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `url(https://images.unsplash.com/${city.img}?w=1920&q=80&auto=format&fit=crop)`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundColor: city.fallback,
                opacity: imgIdx === i ? 1 : 0,
                transition: "opacity 0.75s ease",
              }}
            />
          ))}

          {/* Dark gradient overlay — lighter top, heavier bottom */}
          <div style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,.18) 0%, rgba(0,0,0,.15) 45%, rgba(0,0,0,.62) 100%)",
          }} />

          {/* City name + country labels */}
          {CITIES.map((city, i) => (
            <div
              key={city.name + "_label"}
              style={{
                position: "absolute",
                bottom: "18%",
                left: 0,
                right: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                opacity: imgIdx === i ? 1 : 0,
                transform: imgIdx === i ? "translateY(0)" : "translateY(18px)",
                transition: "opacity 0.5s ease 0.2s, transform 0.5s ease 0.2s",
              }}
            >
              <div style={{
                fontFamily: "var(--font-serif), Georgia, serif",
                fontSize: "clamp(48px, 7.5vw, 106px)",
                fontWeight: 500,
                letterSpacing: "-0.032em",
                lineHeight: 1,
                color: "white",
                fontStyle: city.italic ? "italic" : "normal",
                textShadow: "0 2px 24px rgba(0,0,0,.28)",
                whiteSpace: "nowrap",
              }}>
                {city.name}
              </div>
              <div style={{
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                color: "rgba(255,255,255,.52)",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
              }}>
                {city.country}
              </div>
            </div>
          ))}
        </div>

        {/* Animation stage */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            maxWidth: 960,
            height: 220,
          }}
        >

          {/* "Destinations, simplified" — phase 1 & 2 */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.12em",
              opacity: phase >= 1 && phase < 3 ? 1 : 0,
              transform:
                phase >= 2
                  ? "scale(0.06)"
                  : "scale(1)",
              transition:
                phase === 2
                  ? "opacity 0.75s ease 0.15s, transform 0.85s cubic-bezier(0.4,0,1,1)"
                  : "opacity 0.5s ease",
              pointerEvents: "none",
            }}
          >
            {/* "Destinations," */}
            <div
              style={{
                fontFamily: "var(--font-serif), Georgia, serif",
                fontSize: "clamp(38px, 6.8vw, 94px)",
                fontWeight: 500,
                letterSpacing: "-0.035em",
                lineHeight: 1,
                color: "var(--charcoal)",
                whiteSpace: "nowrap",
                opacity: phase >= 1 ? 1 : 0,
                transform: phase >= 1 ? "translateY(0)" : "translateY(-22px)",
                transition: "opacity 0.65s ease, transform 0.65s ease",
              }}
            >
              Destinations,
            </div>

            {/* "simplified" */}
            <div
              style={{
                fontFamily: "var(--font-serif), Georgia, serif",
                fontSize: "clamp(38px, 6.8vw, 94px)",
                fontWeight: 500,
                letterSpacing: "-0.035em",
                lineHeight: 1,
                fontStyle: "italic",
                color: "var(--terracotta)",
                whiteSpace: "nowrap",
                opacity: phase >= 1 ? 1 : 0,
                transform: phase >= 1 ? "translateY(0)" : "translateY(22px)",
                transition: "opacity 0.65s ease 0.1s, transform 0.65s ease 0.1s",
              }}
            >
              simplified
            </div>
          </div>

          {/* Pulse ring — fires when Destify appears */}
          {phase >= 3 && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 160,
                height: 160,
                marginLeft: -80,
                marginTop: -80,
                borderRadius: "50%",
                border: "1.5px solid rgba(110,128,104,.28)",
                animation: "ring-out 1.1s ease-out forwards",
                pointerEvents: "none",
              }}
            />
          )}

          {/* "Destify" — phase 3+ */}
          {phase >= 3 && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                fontFamily: "var(--font-serif), Georgia, serif",
                fontSize: "clamp(52px, 8.5vw, 116px)",
                fontWeight: 500,
                letterSpacing: "-0.035em",
                lineHeight: 1,
                color: "var(--charcoal)",
                whiteSpace: "nowrap",
                animation: "destify-bloom 0.72s cubic-bezier(0.34,1.56,0.64,1) forwards",
                pointerEvents: "none",
              }}
            >
              Dest<em style={{ fontStyle: "italic", color: "var(--sage-deep)" }}>ify</em>
            </div>
          )}
        </div>

        {/* Tagline + CTA — phase 4 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.75rem",
            marginTop: "2.25rem",
            opacity: phase >= 4 ? 1 : 0,
            transform: phase >= 4 ? "translateY(0)" : "translateY(18px)",
            transition: "opacity 0.9s ease, transform 0.9s ease",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(15px, 1.3vw, 18px)",
              color: "var(--mocha)",
              textAlign: "center",
              maxWidth: 440,
              lineHeight: 1.7,
              padding: "0 1.5rem",
            }}
          >
            Your itinerary, your route, your checklists —<br />
            all in one quietly beautiful place.
          </p>

          <Link
            href="/organizer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "linear-gradient(135deg, var(--sage) 0%, var(--ocean) 100%)",
              color: "var(--cream)",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: 500,
              padding: "12px 26px",
              borderRadius: 999,
              textDecoration: "none",
              letterSpacing: "-0.01em",
              boxShadow:
                "0 4px 24px rgba(45,90,123,.2), 0 1px 4px rgba(0,0,0,.05)",
            }}
          >
            Start planning
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Scroll indicator */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            opacity: phase >= 4 ? 1 : 0,
            transition: "opacity 1s ease 0.8s",
            pointerEvents: "none",
            animation: phase >= 4 ? "scroll-bob 2.4s ease-in-out infinite" : "none",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--mocha-soft)",
            }}
          >
            scroll
          </span>
          <div
            style={{
              width: 1,
              height: 32,
              background:
                "linear-gradient(180deg, var(--mocha-soft) 0%, transparent 100%)",
            }}
          />
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "108px 24px 96px",
          maxWidth: 1080,
          margin: "0 auto",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <h2
            style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "clamp(30px, 4vw, 52px)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              color: "var(--charcoal)",
              marginBottom: 14,
            }}
          >
            Everything your trip{" "}
            <em style={{ fontStyle: "italic", color: "var(--terracotta)" }}>
              needs
            </em>
          </h2>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              color: "var(--mocha)",
              maxWidth: 400,
              margin: "0 auto",
              lineHeight: 1.65,
            }}
          >
            Three tools. One organizer. Zero spreadsheets.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
          }}
        >
          <FeatureCard
            icon={<Clock3 size={18} />}
            accent="var(--sage)"
            title="Interactive Timeline"
            body="See every stop, flight, and experience laid out day-by-day. Drag to reorder. Toggle detail on the fly."
          />
          <FeatureCard
            icon={<Map size={18} />}
            accent="var(--ocean)"
            title="Live Route Map"
            body="Your journey traced on an interactive map — pins, paths, and distances updating as you build your itinerary."
          />
          <FeatureCard
            icon={<CheckSquare2 size={18} />}
            accent="var(--terracotta)"
            title="Smart Checklists"
            body="Decision-tree guided prep that adapts to your specific trip. Visas, vaccines, packing — nothing slips through."
          />
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────── */}
      <section
        style={{
          padding: "80px 24px 104px",
          background:
            "radial-gradient(500px 350px at 85% 40%, rgba(184,168,216,.09), transparent 60%)," +
            "var(--cream-warm)",
        }}
      >
        <div style={{ maxWidth: 660, margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "clamp(26px, 3.5vw, 44px)",
              fontWeight: 500,
              letterSpacing: "-0.03em",
              color: "var(--charcoal)",
              marginBottom: 56,
              textAlign: "center",
            }}
          >
            Planning,{" "}
            <em style={{ fontStyle: "italic", color: "var(--sage-deep)" }}>
              simplified
            </em>
          </h2>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <StepRow
              n="01"
              title="Add your destinations"
              body="Drop in where you're going. Destify plots your route and calculates distances automatically."
            />
            <StepRow
              n="02"
              title="Build your itinerary"
              body="Add activities, hotels, and transit legs to a timeline that updates your map in real time."
            />
            <StepRow
              n="03"
              title="Follow the checklist"
              body="The guided flow walks you through everything you need to prepare — tailored to your specific journey."
              last
            />
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "100px 24px 120px",
          textAlign: "center",
          borderTop: "1px solid rgba(148,139,130,.1)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "var(--sand)",
            border: "1px solid rgba(148,139,130,.14)",
            borderRadius: 99,
            padding: "5px 14px",
            fontSize: 11,
            fontFamily: "var(--font-sans)",
            color: "var(--mocha)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          <Sparkles size={11} />
          Free to use
        </div>

        <h2
          style={{
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: "clamp(30px, 4.5vw, 58px)",
            fontWeight: 500,
            letterSpacing: "-0.03em",
            color: "var(--charcoal)",
            marginBottom: 18,
            lineHeight: 1.1,
          }}
        >
          Ready for your next{" "}
          <em style={{ fontStyle: "italic", color: "var(--terracotta)" }}>
            adventure?
          </em>
        </h2>

        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            color: "var(--mocha)",
            marginBottom: 40,
            lineHeight: 1.6,
          }}
        >
          Open the organizer and start shaping your trip.
        </p>

        <Link
          href="/organizer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "linear-gradient(135deg, var(--sage) 0%, var(--ocean) 100%)",
            color: "var(--cream)",
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            fontWeight: 500,
            padding: "14px 30px",
            borderRadius: 999,
            textDecoration: "none",
            letterSpacing: "-0.01em",
            boxShadow:
              "0 4px 28px rgba(45,90,123,.22), 0 1px 4px rgba(0,0,0,.05)",
          }}
        >
          Open my organizer
          <ArrowRight size={15} />
        </Link>
      </section>
    </>
  );
}

/* ── Sub-components ───────────────────────────────────────────────────── */

function FeatureCard({
  icon,
  accent,
  title,
  body,
}: {
  icon: React.ReactNode;
  accent: string;
  title: string;
  body: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        background: "var(--cream)",
        border: "1px solid rgba(148,139,130,.11)",
        borderRadius: 16,
        padding: "26px 26px 30px",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(22px)",
        transition: "opacity 0.7s ease, transform 0.7s ease",
        boxShadow:
          "0 1px 3px rgba(44,48,51,.03), 0 6px 20px rgba(44,48,51,.03)",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `color-mix(in srgb, ${accent} 14%, transparent)`,
          color: accent,
          marginBottom: 18,
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: "var(--charcoal)",
          marginBottom: 8,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          color: "var(--mocha)",
          lineHeight: 1.7,
        }}
      >
        {body}
      </p>
    </div>
  );
}

function StepRow({
  n,
  title,
  body,
  last,
}: {
  n: string;
  title: string;
  body: string;
  last?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        gap: 24,
        alignItems: "flex-start",
        paddingBottom: last ? 0 : 40,
        borderBottom: last ? "none" : "1px solid rgba(148,139,130,.1)",
        marginBottom: last ? 0 : 40,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(-18px)",
        transition: "opacity 0.7s ease, transform 0.7s ease",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: 11,
          color: "var(--mocha-soft)",
          letterSpacing: "0.06em",
          minWidth: 26,
          paddingTop: 5,
          flexShrink: 0,
        }}
      >
        {n}
      </div>
      <div style={{ flex: 1 }}>
        <h3
          style={{
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: "clamp(18px, 2vw, 24px)",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "var(--charcoal)",
            marginBottom: 7,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            color: "var(--mocha)",
            lineHeight: 1.7,
          }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}

