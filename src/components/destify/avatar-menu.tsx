"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOutAction } from "@/lib/auth-actions";

export function AvatarMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const signOut = async () => {
    try { await signOutAction(); } catch { /* network noise, still navigate */ }
    router.push('/login');
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="grid h-8 w-8 place-items-center rounded-full text-[13px] font-semibold text-white"
        style={{ background: 'var(--grad-avatar)', cursor: 'pointer', border: 'none' }}>
        GV
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', minWidth: 180, background: 'white', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,.12)', padding: 6, zIndex: 50 }}>
          <Link href="/profile" onClick={() => setOpen(false)}
            style={{ display: 'block', padding: '9px 12px', borderRadius: 8, color: 'var(--charcoal)', textDecoration: 'none', fontSize: 13.5 }}>
            Edit profile
          </Link>
          <button type="button" onClick={signOut}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 8, color: 'var(--charcoal)', fontSize: 13.5, background: 'none', border: 'none', cursor: 'pointer' }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
