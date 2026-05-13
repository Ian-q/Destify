"use client";

import { useEffect, useState } from "react";

type ToastItem = { id: number; message: string };

const listeners = new Set<(t: ToastItem) => void>();
let nextId = 0;

export function toast(message: string) {
  const item: ToastItem = { id: nextId++, message };
  listeners.forEach((cb) => cb(item));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const cb = (t: ToastItem) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, 2400);
    };
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          style={{
            background: "var(--charcoal)",
            color: "var(--cream)",
            padding: "10px 18px",
            borderRadius: 999,
            fontFamily: "var(--font-sans)",
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            boxShadow: "0 8px 32px rgba(0,0,0,.22)",
            animation: "toast-in 220ms ease both",
          }}
        >
          {t.message}
        </div>
      ))}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
