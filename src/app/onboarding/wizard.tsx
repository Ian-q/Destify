"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProfileAction } from "@/lib/profile-actions";
import { COUNTRIES } from "@/lib/iso-countries";
import { toast } from "@/components/destify/toast";

type Tier1 = {
  citizenships: { country: string; passportExpiry: string | null }[];
  residence: { country: string; visaStatus: 'tourist' | 'permanent' | 'digital-nomad' | 'work' | 'other' | null } | null;
  idpConvention: '1949' | '1968' | null;
  idpExpiry: string | null;
  controlledMeds: string[];
  hasMinors: boolean;
  drivesAbroad: boolean; // wizard-local toggle; not persisted
};

const EMPTY: Tier1 = {
  citizenships: [],
  residence: null,
  idpConvention: null, idpExpiry: null,
  controlledMeds: [], hasMinors: false,
  drivesAbroad: true,
};

export function Wizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Tier1>(EMPTY);
  const [pending, startTransition] = useTransition();

  const save = (next: Tier1, after: () => void) => {
    startTransition(async () => {
      try {
        await saveProfileAction({
          citizenships: next.citizenships,
          residence: next.residence,
          idpConvention: next.drivesAbroad ? next.idpConvention : null,
          idpExpiry: next.drivesAbroad ? next.idpExpiry : null,
          controlledMeds: next.controlledMeds,
          hasMinors: next.hasMinors,
        });
        after();
      } catch {
        toast("Couldn't save — please retry");
      }
    });
  };

  const finish = () => save(data, () => router.push('/organizer'));

  return (
    <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--cream-warm)' }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'white', borderRadius: 18, padding: 32, boxShadow: '0 8px 32px rgba(0,0,0,.06)' }}>
        <Progress step={step} total={3} />
        {step === 0 && <Identity data={data} setData={setData} />}
        {step === 1 && <Driving data={data} setData={setData} />}
        {step === 2 && <Health data={data} setData={setData} />}
        <Footer
          step={step}
          pending={pending}
          onBack={() => setStep((s) => Math.max(0, s - 1))}
          onSkip={finish}
          onNext={() => (step === 2 ? finish() : setStep((s) => s + 1))}
        />
      </div>
    </div>
  );
}

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} style={{
          width: 8, height: 8, borderRadius: 999,
          background: i === step ? 'var(--charcoal)' : 'rgba(148,139,130,.28)',
        }} />
      ))}
    </div>
  );
}

function Identity({ data, setData }: { data: Tier1; setData: (d: Tier1) => void }) {
  const setCitizenshipExpiry = (country: string, expiry: string | null) => {
    setData({
      ...data,
      citizenships: data.citizenships.map((c) =>
        c.country === country ? { ...c, passportExpiry: expiry } : c,
      ),
    });
  };

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 4 }}>About you</h2>
      <p style={{ color: 'var(--mocha)', marginBottom: 20, fontSize: 14 }}>Used to personalize visa, driving, and health rules.</p>

      <Label>Citizenships</Label>
      <MultiCountry
        value={data.citizenships.map((c) => c.country)}
        onChange={(codes) => {
          const next = codes.map((code) =>
            data.citizenships.find((c) => c.country === code) ?? { country: code, passportExpiry: null },
          );
          setData({ ...data, citizenships: next });
        }}
      />

      {data.citizenships.map((c) => (
        <div key={c.country} style={{ marginTop: 10 }}>
          <Label>{c.country} passport expiry (optional)</Label>
          <input
            type="date"
            value={c.passportExpiry ?? ''}
            onChange={(e) => setCitizenshipExpiry(c.country, e.target.value || null)}
            style={inputStyle}
          />
        </div>
      ))}

      <Label style={{ marginTop: 16 }}>Country of residence</Label>
      <SingleCountry
        value={data.residence?.country ?? null}
        onChange={(v) => setData({
          ...data,
          residence: v ? { country: v, visaStatus: data.residence?.visaStatus ?? null } : null,
        })}
      />

      {data.residence && (
        <>
          <Label style={{ marginTop: 12 }}>Visa status in this country (optional)</Label>
          <select
            value={data.residence.visaStatus ?? ''}
            onChange={(e) => {
              const v = (e.target.value || null) as 'tourist' | 'permanent' | 'digital-nomad' | 'work' | 'other' | null;
              setData({ ...data, residence: { ...data.residence!, visaStatus: v } });
            }}
            style={inputStyle}
          >
            <option value="">— none —</option>
            <option value="tourist">Tourist</option>
            <option value="permanent">Permanent resident</option>
            <option value="digital-nomad">Digital-nomad visa</option>
            <option value="work">Work visa</option>
            <option value="other">Other</option>
          </select>
        </>
      )}

      <Label style={{ marginTop: 16 }}>Traveling with minors?</Label>
      <YesNo value={data.hasMinors} onChange={(v) => setData({ ...data, hasMinors: v })} />
    </div>
  );
}

function Driving({ data, setData }: { data: Tier1; setData: (d: Tier1) => void }) {
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 4 }}>Driving</h2>
      <p style={{ color: 'var(--mocha)', marginBottom: 20, fontSize: 14 }}>Skip if you don&apos;t drive abroad.</p>

      <Label>Drive abroad?</Label>
      <YesNo value={data.drivesAbroad} onChange={(v) => setData({ ...data, drivesAbroad: v })} />

      {data.drivesAbroad && (
        <>
          <Label style={{ marginTop: 16 }}>IDP convention</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['1949', '1968'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setData({ ...data, idpConvention: v })}
                style={segStyle(data.idpConvention === v)}>
                {v}
              </button>
            ))}
          </div>

          <Label style={{ marginTop: 16 }}>IDP expiry</Label>
          <input type="date" value={data.idpExpiry ?? ''}
            onChange={(e) => setData({ ...data, idpExpiry: e.target.value || null })}
            style={inputStyle} />
        </>
      )}
    </div>
  );
}

function Health({ data, setData }: { data: Tier1; setData: (d: Tier1) => void }) {
  const [draft, setDraft] = useState('');
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 24, marginBottom: 4 }}>Health</h2>
      <p style={{ color: 'var(--mocha)', marginBottom: 20, fontSize: 14 }}>Used to flag import-permit requirements.</p>

      <Label>Controlled medications (generic names)</Label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {data.controlledMeds.map((m) => (
          <span key={m} style={chipStyle}>
            {m}
            <button type="button" onClick={() => setData({ ...data, controlledMeds: data.controlledMeds.filter((x) => x !== m) })}
              style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mocha)' }}>×</button>
          </span>
        ))}
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && draft.trim()) {
            e.preventDefault();
            setData({ ...data, controlledMeds: [...data.controlledMeds, draft.trim()] });
            setDraft('');
          }
        }}
        placeholder="Type and press Enter"
        style={inputStyle}
      />
    </div>
  );
}

function Footer({ step, pending, onBack, onSkip, onNext }: { step: number; pending: boolean; onBack: () => void; onSkip: () => void; onNext: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
      <button type="button" onClick={onBack} disabled={step === 0}
        style={{ ...secondaryBtn, opacity: step === 0 ? 0.4 : 1 }}>Back</button>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={onSkip} disabled={pending} style={secondaryBtn}>Skip</button>
        <button type="button" onClick={onNext} disabled={pending} style={primaryBtn}>
          {step === 2 ? 'Finish' : 'Continue'}
        </button>
      </div>
    </div>
  );
}

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--mocha)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6, ...style }}>{children}</div>;
}

function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {[{ k: true, l: 'Yes' }, { k: false, l: 'No' }].map((o) => (
        <button key={o.l} type="button" onClick={() => onChange(o.k)}
          style={segStyle(value === o.k)}>{o.l}</button>
      ))}
    </div>
  );
}

function MultiCountry({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {value.map((c) => (
          <span key={c} style={chipStyle}>
            {c}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== c))}
              style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mocha)' }}>×</button>
          </span>
        ))}
      </div>
      <select onChange={(e) => { if (e.target.value && !value.includes(e.target.value)) onChange([...value, e.target.value]); e.target.value = ''; }}
        style={inputStyle} defaultValue="">
        <option value="" disabled>Add a country</option>
        {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
      </select>
    </div>
  );
}

function SingleCountry({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}
      style={inputStyle}>
      <option value="">— select —</option>
      {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
    </select>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(253,251,247,.7)',
  border: '1.5px solid rgba(148,139,130,.18)', borderRadius: 10,
  padding: '11px 14px', fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--charcoal)',
  outline: 'none', boxSizing: 'border-box',
};
const segStyle = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '10px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500,
  border: '1.5px solid ' + (active ? 'var(--charcoal)' : 'rgba(148,139,130,.22)'),
  background: active ? 'var(--charcoal)' : 'transparent',
  color: active ? 'var(--cream)' : 'var(--charcoal)', cursor: 'pointer',
});
const chipStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', padding: '4px 10px', borderRadius: 999,
  background: 'var(--sand)', fontSize: 12.5, color: 'var(--charcoal)',
};
const primaryBtn: React.CSSProperties = {
  padding: '10px 22px', borderRadius: 999, border: 'none',
  background: 'linear-gradient(135deg, var(--sage) 0%, var(--ocean) 100%)',
  color: 'var(--cream)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  padding: '10px 18px', borderRadius: 999, border: '1.5px solid rgba(148,139,130,.22)',
  background: 'transparent', color: 'var(--mocha)', fontSize: 13, cursor: 'pointer',
};
