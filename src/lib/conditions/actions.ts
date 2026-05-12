'use server';

import { eq, and, desc } from 'drizzle-orm';
import { db as prodDb } from '@/lib/db/client';
import { trip, leg } from '@/lib/db/schema';
import { hydrateLeg } from './readiness';
import { resolveFlow as runResolver, legSeqForFlow } from '@/lib/rules/index';
import { loadProfile, loadTripContext } from '@/lib/profile-db';
import { requireSession } from '@/lib/session';
import type { PermanentProfile, TripContext } from '@/lib/user-profile';
import type { Leg, ResolverOutput } from '@/lib/rules/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

const DEFAULT_PROFILE = (userId: string): PermanentProfile => ({
  userId,
  citizenships: [],
  homeCountry: null,
  idpConvention: null,
  idpExpiry: null,
  controlledMeds: [],
  hasMinors: false,
  extras: {},
});

const DEFAULT_CONTEXT = (tripId: string): TripContext => ({
  tripId,
  travelingWithMinors: false,
  drivingAtDestination: false,
  carryingControlledMeds: false,
  purpose: null,
  extras: {},
});

async function loadActiveTrip(db: AnyDb, userId: string) {
  const rows = await db.select().from(trip).where(eq(trip.userId, userId)).orderBy(desc(trip.createdAt)).limit(1);
  if (rows.length === 0) throw new Error('No trip for user');
  return rows[0];
}

async function loadLegForFlow(db: AnyDb, tripId: string, flowId: string): Promise<Leg> {
  const seq = legSeqForFlow(flowId);
  if (seq === null) throw new Error(`No leg-seq mapping for flow ${flowId}`);
  const rows = await db.select().from(leg).where(and(eq(leg.tripId, tripId), eq(leg.seq, seq)));
  if (rows.length === 0) throw new Error(`No leg seq=${seq} for trip ${tripId}`);
  const r = rows[0];
  return {
    from: r.fromCountry,
    to: r.toCountry,
    startDate: r.startDate,
    endDate: r.endDate,
  };
}

/** Internal helper exposed for tests; takes a db handle. */
export async function resolveFlow(
  db: AnyDb,
  flowId: string,
): Promise<{ output: ResolverOutput; missing: { type: string; key: string }[]; leg: Leg }> {
  const userId = await requireSession();
  const profile = (await loadProfile(db, userId)) ?? DEFAULT_PROFILE(userId);
  const t = await loadActiveTrip(db, userId);
  const legRow = await loadLegForFlow(db, t.id, flowId);
  const context = (await loadTripContext(db, t.id)) ?? DEFAULT_CONTEXT(t.id);
  const { facts, missing } = await hydrateLeg(profile, context, legRow, { flowId, db });
  const output = runResolver(flowId, profile, context, legRow, { tables: facts.tables });
  return { output, missing, leg: legRow };
}

export async function resolveFlowAction(
  flowId: string,
): Promise<{ output: ResolverOutput; missing: { type: string; key: string }[]; leg: Leg }> {
  return resolveFlow(prodDb, flowId);
}
