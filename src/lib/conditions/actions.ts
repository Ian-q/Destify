'use server';

import { hydrateLeg } from './readiness';
import { resolveFlow } from '@/lib/rules/index';
import type { PermanentProfile, TripContext } from '@/lib/user-profile';
import type { Leg, ResolverOutput } from '@/lib/rules/types';

export async function resolveFlowAction(
  flowId: string,
  profile: PermanentProfile,
  context: TripContext,
  leg: Leg,
): Promise<{ output: ResolverOutput; missing: { type: string; key: string }[] }> {
  const { facts, missing } = await hydrateLeg(profile, context, leg, { flowId });
  const output = resolveFlow(flowId, profile, context, leg, { tables: facts.tables });
  return { output, missing };
}
