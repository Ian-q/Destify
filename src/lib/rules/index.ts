import { resolvePreflightJP } from './jp/preflight';
import { buildFacts } from './facts';
import type { FlowResolver, Facts, Leg, ResolverOutput } from './types';
import type { RowType } from '@/lib/conditions/registry';
import type { PermanentProfile, TripContext } from '@/lib/user-profile';

export type FlowEntry = {
  resolver: FlowResolver;
  requiredRows: (facts: Facts) => Array<{ type: RowType; key: string }>;
};

export const REGISTRY: Record<string, FlowEntry> = {
  'preflight-jp': {
    resolver: resolvePreflightJP,
    requiredRows: (f) => [
      ...f.citizenships.map((c) => ({ type: 'visa_exemption' as const, key: `${c}:${f.toCountry}` })),
      { type: 'med_import' as const, key: f.toCountry },
      { type: 'driving' as const,    key: f.toCountry },
    ],
  },
};

export function resolveFlow(
  flowId: string,
  profile: PermanentProfile | null,
  context: TripContext | null,
  leg: Leg,
  hydrated: { tables?: Facts['tables'] } = {},
): ResolverOutput {
  if (!profile || !context) return {};
  const entry = REGISTRY[flowId];
  if (!entry) return {};
  try {
    return entry.resolver(buildFacts(profile, context, leg, hydrated));
  } catch (err) {
    console.error(`[rules] resolver for ${flowId} threw:`, err);
    return {};
  }
}

export const FLOW_LEG_SEQ: Record<string, number> = {
  'preflight-jp': 0,
  'domestic-jp':  1,
  'return-jp':    2,
};

export function legSeqForFlow(flowId: string): number | null {
  return FLOW_LEG_SEQ[flowId] ?? null;
}
