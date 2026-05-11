import { buildFacts } from '@/lib/rules/facts';
import { REGISTRY } from '@/lib/rules/index';
import { getRow } from './index';
import type { Facts, Leg } from '@/lib/rules/types';
import type { PermanentProfile, TripContext } from '@/lib/user-profile';
import type { RowType } from './registry';

export type MissingRow = { type: RowType; key: string };
export type HydratedLeg = {
  facts: Facts;
  missing: MissingRow[];
};

export async function hydrateLeg(
  profile: PermanentProfile,
  context: TripContext,
  leg: Leg,
  opts: { flowId: string; db?: any },
): Promise<HydratedLeg> {
  const skeletonFacts = buildFacts(profile, context, leg);
  const entry = REGISTRY[opts.flowId];
  if (!entry) {
    return { facts: skeletonFacts, missing: [] };
  }
  const required = entry.requiredRows(skeletonFacts);
  const resolved = await Promise.all(
    required.map((r) => getRow(r.type, r.key, { db: opts.db }).then((data) => ({ ...r, data }))),
  );
  const tables: Facts['tables'] = {};
  const missing: MissingRow[] = [];
  for (const r of resolved) {
    if (r.data === null) {
      missing.push({ type: r.type, key: r.key });
      continue;
    }
    const tablesAny = tables as Record<string, Record<string, unknown>>;
    (tablesAny[r.type] ??= {})[r.key] = r.data;
  }
  return { facts: buildFacts(profile, context, leg, { tables }), missing };
}
