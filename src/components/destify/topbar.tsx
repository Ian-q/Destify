import { Sparkles, Clock } from "lucide-react";

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
      <div className="flex items-center gap-2.5 font-medium tracking-tight">
        <div
          className="grid h-7 w-7 place-items-center rounded-lg text-cream"
          style={{
            background: "linear-gradient(135deg, var(--sage) 0%, var(--ocean) 100%)",
          }}
          aria-hidden="true"
        >
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="font-serif text-[18px] font-medium">
          Dest<em className="not-italic" style={{ fontStyle: "italic", color: "var(--sage-deep)" }}>ify</em>
        </div>
      </div>

      <nav className="ml-2 flex gap-1">
        {[
          { label: "My trips", active: true },
          { label: "Plan a trip" },
          { label: "Documents" },
          { label: "Inspiration" },
        ].map((n) => (
          <a
            key={n.label}
            href="#"
            className="rounded-md px-3 py-1.5 text-sm transition-colors"
            style={{
              color: n.active ? "var(--charcoal)" : "var(--mocha)",
              background: n.active ? "var(--sand)" : "transparent",
            }}
          >
            {n.label}
          </a>
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
          className="rounded-full border px-3 py-1.5 text-[13px]"
          style={{
            background: "var(--cream)",
            borderColor: "rgba(148,139,130,.18)",
            color: "var(--charcoal-soft)",
          }}
        >
          Share
        </button>
        <div
          className="grid h-8 w-8 place-items-center rounded-full text-[13px] font-semibold text-white"
          style={{ background: "linear-gradient(135deg, var(--terracotta), var(--lavender))" }}
        >
          GV
        </div>
      </div>
    </header>
  );
}
