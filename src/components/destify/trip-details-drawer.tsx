"use client";

import { useState, useTransition } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { saveTripContextAction } from "@/lib/profile-actions";
import { toast } from "./toast";
import type { TripContext } from "@/lib/user-profile";

type Purpose = 'tourism' | 'business' | 'family' | 'study';
const PURPOSES: Purpose[] = ['tourism', 'business', 'family', 'study'];

export function TripDetailsDrawer({
  open, onOpenChange, tripId, initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tripId: string;
  initial: TripContext | null;
}) {
  const [minors, setMinors] = useState(initial?.travelingWithMinors ?? false);
  const [driving, setDriving] = useState(initial?.drivingAtDestination ?? false);
  const [meds, setMeds] = useState(initial?.carryingControlledMeds ?? false);
  const [purpose, setPurpose] = useState<Purpose | null>(initial?.purpose ?? null);
  const [pending, startTransition] = useTransition();

  const save = () => startTransition(async () => {
    try {
      await saveTripContextAction(tripId, {
        travelingWithMinors: minors,
        drivingAtDestination: driving,
        carryingControlledMeds: meds,
        purpose,
      });
      toast('Trip details saved');
      onOpenChange(false);
    } catch {
      toast("Couldn't save — please retry");
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" style={{ padding: 24, width: 380 }}>
        <SheetHeader><SheetTitle>Trip details</SheetTitle></SheetHeader>
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Toggle label="Traveling with minors" value={minors} onChange={setMinors} />
          <Toggle label="Driving at destination" value={driving} onChange={setDriving} />
          <Toggle label="Carrying controlled meds" value={meds} onChange={setMeds} />
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--mocha)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Purpose</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PURPOSES.map((p) => (
                <button key={p} type="button" onClick={() => setPurpose(p === purpose ? null : p)}
                  style={{ padding: '8px 14px', borderRadius: 999, fontSize: 13, border: '1.5px solid ' + (purpose === p ? 'var(--charcoal)' : 'rgba(148,139,130,.22)'), background: purpose === p ? 'var(--charcoal)' : 'transparent', color: purpose === p ? 'var(--cream)' : 'var(--charcoal)', cursor: 'pointer' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <button type="button" onClick={save} disabled={pending}
            style={{ marginTop: 12, padding: '12px 22px', borderRadius: 999, border: 'none', background: 'linear-gradient(135deg, var(--sage) 0%, var(--ocean) 100%)', color: 'var(--cream)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
      <span style={{ fontSize: 14 }}>{label}</span>
      <button type="button" onClick={() => onChange(!value)}
        style={{ width: 40, height: 22, borderRadius: 999, border: 'none', background: value ? 'var(--sage-deep)' : 'rgba(148,139,130,.32)', position: 'relative', cursor: 'pointer' }}>
        <span style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 16, height: 16, borderRadius: 999, background: 'white', transition: 'left 0.18s' }} />
      </button>
    </label>
  );
}
