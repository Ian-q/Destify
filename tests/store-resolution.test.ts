import { describe, it, expect, beforeEach } from 'vitest';

import { useTripStore } from '@/lib/use-trip-store';
import { TRIP } from '@/lib/trip-data';

function defaultChoiceId(flowId: string, nodeId: string): string {
  const flow = TRIP.flows[flowId];
  const node = flow.nodes.find((n) => n.id === nodeId);
  if (!node?.choices) throw new Error(`No choices for ${nodeId}`);
  return (node.choices.find((c) => c.on) ?? node.choices[0]).id;
}

function freshStore(): void {
  const initialChoices: Record<string, Record<string, string>> = {};
  for (const [fid, flow] of Object.entries(TRIP.flows)) {
    initialChoices[fid] = {};
    for (const n of flow.nodes) {
      if (n.choices) {
        const def = n.choices.find((c) => c.on) || n.choices[0];
        initialChoices[fid][n.id] = def.id;
      }
    }
  }
  useTripStore.setState({
    flowChoices: initialChoices,
    flowResolved: {},
    flowOverrides: {},
  });
}

describe('applyResolution', () => {
  beforeEach(freshStore);

  it('writes a new auto-resolution into flowChoices and flowResolved', () => {
    const { applyResolution } = useTripStore.getState();
    applyResolution('preflight-jp', {
      'n-visa': { choiceId: 'no', ruleId: 'jp.preflight.visa.us-exempt', reason: 'US passport, exempt' },
    });
    expect(useTripStore.getState().flowChoices['preflight-jp']['n-visa']).toBe('no');
    expect(useTripStore.getState().flowResolved['preflight-jp']['n-visa']).toEqual({
      choiceId: 'no',
      ruleId: 'jp.preflight.visa.us-exempt',
      reason: 'US passport, exempt',
    });
  });

  it('restores a previously-auto-resolved node to its default when the new output omits it', () => {
    // Bug #8: switching citizenship from US to a country with no seed row.
    // Use n-visa with auto-value 'yes' (visa required) — differs from default 'no' so
    // the bug actually manifests visibly. The real US case auto-resolves to 'no' which
    // happens to also be the default, hiding the bug.
    const { applyResolution } = useTripStore.getState();
    applyResolution('preflight-jp', {
      'n-visa': { choiceId: 'yes', ruleId: 'visa-required-test', reason: 'test fixture' },
    });
    expect(useTripStore.getState().flowChoices['preflight-jp']['n-visa']).toBe('yes');

    // Now: re-resolve with empty output (no rule fired for the new citizenship).
    applyResolution('preflight-jp', {});

    // flowChoices['n-visa'] must revert to the trip-data default ('no'), not stay on 'yes'.
    expect(useTripStore.getState().flowChoices['preflight-jp']['n-visa'])
      .toBe(defaultChoiceId('preflight-jp', 'n-visa'));
    // flowResolved is fully replaced.
    expect(useTripStore.getState().flowResolved['preflight-jp']).toEqual({});
  });

  it('switches a node from one auto-resolution to another', () => {
    const { applyResolution } = useTripStore.getState();
    applyResolution('preflight-jp', {
      'n-visa': { choiceId: 'no', ruleId: 'visa-exempt', reason: '' },
    });
    applyResolution('preflight-jp', {
      'n-visa': { choiceId: 'yes', ruleId: 'visa-required', reason: '' },
    });
    expect(useTripStore.getState().flowChoices['preflight-jp']['n-visa']).toBe('yes');
  });

  it('does not touch nodes that were never auto-resolved', () => {
    const { applyResolution, setFlowChoice } = useTripStore.getState();
    // User manually sets n-meds — this node is never in any auto-resolution in this test.
    setFlowChoice('preflight-jp', 'n-meds', 'yes-common');

    applyResolution('preflight-jp', {
      'n-visa': { choiceId: 'no', ruleId: 'us', reason: '' },
    });
    expect(useTripStore.getState().flowChoices['preflight-jp']['n-meds']).toBe('yes-common');

    // Re-resolve with a different output that omits n-visa entirely but doesn't include n-meds either.
    // The default-matching-coincidence of n-visa here doesn't break the assertion; we're testing that n-meds is untouched.
    applyResolution('preflight-jp', {});
    expect(useTripStore.getState().flowChoices['preflight-jp']['n-meds']).toBe('yes-common');
  });

  it('respects flowOverrides over the new auto-resolution', () => {
    const { applyResolution } = useTripStore.getState();
    useTripStore.setState({
      flowOverrides: { 'preflight-jp': { 'n-visa': 'yes' } },
    });
    applyResolution('preflight-jp', {
      'n-visa': { choiceId: 'no', ruleId: 'us-exempt', reason: '' },
    });
    // Override wins even though the auto says 'no'.
    expect(useTripStore.getState().flowChoices['preflight-jp']['n-visa']).toBe('yes');
  });
});
