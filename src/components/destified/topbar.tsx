"use client";

import { Sparkles, Clock } from "lucide-react";
import { toast } from "@/components/destified/toast";
import { AvatarMenu } from "./avatar-menu";

const TABS = [
  { label: "My trips", active: true },
  { label: "Plan a trip" },
  { label: "Documents" },
  { label: "Inspiration" },
];

export function TopBar() {
  return (
    <header
      className="sticky top-0 z-50 flex h-15 items-center gap-6 border-b px-7 backdrop-blur"
      style={{
        height: 60,
        borderColor: "rgba(148,139,130,.14)",
        background: "rgba(253,251,247,.85)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className="grid h-7 w-7 place-items-center rounded-lg text-cream"
          style={{ background: "var(--grad-logo)" }}
          aria-hidden="true"
        >
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div
          className="text-[18px] font-semibold"
          style={{ letterSpacing: "-0.03em", color: "var(--charcoal)" }}
        >
          Dest<span style={{ color: "var(--sage-deep)" }}>ify</span>
        </div>
      </div>

      <nav
        className="ml-2 inline-flex gap-0.5 rounded-full border p-[3px]"
        style={{ background: "#ECE4D6", borderColor: "rgba(148,139,130,.18)" }}
      >
        {TABS.map((n) => (
          <button
            key={n.label}
            type="button"
            onClick={() => {
              if (!n.active) toast(`${n.label} — coming soon`);
            }}
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors"
            style={
              n.active
                ? {
                    background: "#FFFFFF",
                    color: "var(--charcoal)",
                    boxShadow:
                      "0 1px 2px rgba(44,48,51,.08), 0 0 0 1px rgba(148,139,130,.12)",
                    cursor: "default",
                  }
                : { background: "transparent", color: "var(--mocha)", cursor: "pointer" }
            }
          >
            {n.active && (
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--terracotta)" }}
              />
            )}
            {n.label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px]"
          style={{
            background: "var(--sand)",
            borderColor: "rgba(148,139,130,.10)",
            color: "var(--charcoal-soft)",
          }}
        >
          <Clock className="h-3.5 w-3.5" />
          Auto-saved · just now
        </span>
        <button
          type="button"
          onClick={() => toast("Share — coming soon")}
          className="rounded-full border px-3 py-1.5 text-[13px] cursor-pointer"
          style={{
            background: "var(--cream)",
            borderColor: "rgba(148,139,130,.18)",
            color: "var(--charcoal-soft)",
          }}
        >
          Share
        </button>
        <AvatarMenu />
      </div>
    </header>
  );
}
