import { describe, it, expect } from 'vitest';
import { resolvePreflightJP } from '@/lib/rules/jp/preflight';
import type { Facts, Leg } from '@/lib/rules/types';

const baseLeg: Leg = { from: 'US', to: 'JP', startDate: '2026-06-01', endDate: '2026-06-02' };

function makeFacts(overrides: Partial<Facts>): Facts {
  return {
    citizenships: [{ country: 'US', passportExpiry: '2029-08-15' }],
    residence: { country: 'US', visaStatus: null },
    controlledMeds: [],
    hasMinors: false,
    idp1949Valid: false,
    idp1968Valid: false,
    travelingWithMinors: false,
    drivingAtDestination: false,
    carryingControlledMeds: false,
    fromCountry: baseLeg.from,
    toCountry: baseLeg.to,
    stayDays: 1,
    leg: baseLeg,
    tables: {},
    ...overrides,
  };
}

describe('resolvePreflightJP n-pass info card', () => {
  it('passes for a US passport valid well past return + 6mo', () => {
    const out = resolvePreflightJP(makeFacts({}));
    const pass = out.info['n-pass'];
    expect(pass).toBeDefined();
    expect(pass.state).toBe('pass');
    expect(pass.title).toMatch(/^US Passport · valid /);
    expect(pass.ruleId).toBe('jp.preflight.pass.valid');
  });

  it('fails when passport expires before return + 6mo', () => {
    const out = resolvePreflightJP(makeFacts({
      citizenships: [{ country: 'US', passportExpiry: '2026-08-01' }],
      leg: { ...baseLeg, endDate: '2026-06-02' },
    }));
    const pass = out.info['n-pass'];
    expect(pass).toBeDefined();
    expect(pass.state).toBe('fail');
    expect(pass.ruleId).toBe('jp.preflight.pass.expires-too-soon');
    expect(pass.title).toMatch(/^US Passport · expires /);
  });

  it('warns when passport has no expiry recorded', () => {
    const out = resolvePreflightJP(makeFacts({
      citizenships: [{ country: 'US', passportExpiry: null }],
    }));
    const pass = out.info['n-pass'];
    expect(pass).toBeDefined();
    expect(pass.state).toBe('warn');
    expect(pass.ruleId).toBe('jp.preflight.pass.no-expiry');
    expect(pass.title).toBe('US Passport · expiry unknown');
  });

  it('warns when profile has no citizenships', () => {
    const out = resolvePreflightJP(makeFacts({ citizenships: [] }));
    const pass = out.info['n-pass'];
    expect(pass).toBeDefined();
    expect(pass.state).toBe('warn');
    expect(pass.ruleId).toBe('jp.preflight.pass.missing');
    expect(pass.title).toBe('No passport on file');
  });

  it('emits "MY Passport · ..." when primary citizenship is MY', () => {
    const out = resolvePreflightJP(makeFacts({
      citizenships: [{ country: 'MY', passportExpiry: '2030-01-15' }],
    }));
    expect(out.info['n-pass'].title).toMatch(/^MY Passport · valid /);
  });
});
