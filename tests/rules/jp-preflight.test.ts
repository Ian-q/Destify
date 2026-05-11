import { describe, it, expect } from 'vitest';
import { resolvePreflightJP } from '@/lib/rules/jp/preflight';
import type { Facts } from '@/lib/rules/types';

function baseFacts(): Facts {
  return {
    citizenships: ['US'], controlledMeds: [], hasMinors: false,
    idp1949Valid: false, idp1968Valid: false,
    travelingWithMinors: false, drivingAtDestination: false, carryingControlledMeds: false,
    fromCountry: 'US', toCountry: 'JP', stayDays: 9,
    tables: { visa_exemption: { 'US:JP': { exemptDays: 90 } } },
  };
}

describe('resolvePreflightJP', () => {
  it('resolves n-visa=no for US passport + 9-night stay using table data', () => {
    const out = resolvePreflightJP(baseFacts());
    expect(out['n-visa'].choiceId).toBe('no');
    expect(out['n-visa'].ruleId).toBe('jp.preflight.visa.us-exempt');
  });

  it('does not resolve n-visa when no visa_exemption row present', () => {
    const f = baseFacts();
    f.tables = {};
    const out = resolvePreflightJP(f);
    expect(out['n-visa']).toBeUndefined();
  });

  it('resolves n-drive=yes when driving with valid 1949 IDP', () => {
    const f = baseFacts();
    f.drivingAtDestination = true;
    f.idp1949Valid = true;
    const out = resolvePreflightJP(f);
    expect(out['n-drive'].choiceId).toBe('yes');
  });

  it('leaves n-drive unresolved when driving without an IDP fact', () => {
    const f = baseFacts();
    f.drivingAtDestination = true;
    const out = resolvePreflightJP(f);
    expect(out['n-drive']).toBeUndefined();
  });
});
