'use server';

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { permanentProfile, tripContext, trip } from '@/lib/db/schema';
import { ProfileExtras, TripContextExtras } from '@/lib/profile-extras';
import { requireSession } from '@/lib/session';
import type { PermanentProfile, TripContext } from '@/lib/user-profile';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

export const Tier1ProfileInput = z.object({
  citizenships:   z.array(z.string().length(2)),
  homeCountry:    z.string().length(2).nullable(),
  idpConvention:  z.enum(['1949', '1968']).nullable(),
  idpExpiry:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  controlledMeds: z.array(z.string().min(1)),
  hasMinors:      z.boolean(),
  extras:         ProfileExtras.optional(),
}).strict();

export const TripContextInput = z.object({
  travelingWithMinors:    z.boolean(),
  drivingAtDestination:   z.boolean(),
  carryingControlledMeds: z.boolean(),
  purpose:                z.enum(['tourism', 'business', 'family', 'study']).nullable(),
  extras:                 TripContextExtras.optional(),
}).strict();

export async function loadProfile(db: AnyDb, userId: string): Promise<PermanentProfile | null> {
  const rows = await db.select().from(permanentProfile).where(eq(permanentProfile.userId, userId));
  if (rows.length === 0) return null;
  const r = rows[0];
  const parsedExtras = ProfileExtras.safeParse(r.extras);
  return {
    userId: r.userId,
    citizenships: r.citizenships ?? [],
    homeCountry: r.homeCountry,
    idpConvention: r.idpConvention,
    idpExpiry: r.idpExpiry,
    controlledMeds: r.controlledMeds ?? [],
    hasMinors: r.hasMinors,
    extras: parsedExtras.success ? parsedExtras.data : {},
  };
}

export async function saveProfile(db: AnyDb, userId: string, input: z.input<typeof Tier1ProfileInput>): Promise<void> {
  const parsed = Tier1ProfileInput.parse(input);
  await db.insert(permanentProfile).values({
    userId,
    citizenships: parsed.citizenships,
    homeCountry: parsed.homeCountry,
    idpConvention: parsed.idpConvention,
    idpExpiry: parsed.idpExpiry,
    controlledMeds: parsed.controlledMeds,
    hasMinors: parsed.hasMinors,
    extras: parsed.extras ?? {},
  }).onConflictDoUpdate({
    target: permanentProfile.userId,
    set: {
      citizenships: parsed.citizenships,
      homeCountry: parsed.homeCountry,
      idpConvention: parsed.idpConvention,
      idpExpiry: parsed.idpExpiry,
      controlledMeds: parsed.controlledMeds,
      hasMinors: parsed.hasMinors,
      extras: parsed.extras ?? {},
      updatedAt: new Date(),
    },
  });
}

async function assertTripOwned(db: AnyDb, userId: string, tripId: string): Promise<void> {
  const rows = await db.select({ id: trip.id }).from(trip).where(and(eq(trip.id, tripId), eq(trip.userId, userId)));
  if (rows.length === 0) throw new Error('Forbidden');
}

export async function loadTripContext(db: AnyDb, tripId: string): Promise<TripContext | null> {
  const rows = await db.select().from(tripContext).where(eq(tripContext.tripId, tripId));
  if (rows.length === 0) return null;
  const r = rows[0];
  const parsedExtras = TripContextExtras.safeParse(r.extras);
  return {
    tripId: r.tripId,
    travelingWithMinors: r.travelingWithMinors,
    drivingAtDestination: r.drivingAtDestination,
    carryingControlledMeds: r.carryingControlledMeds,
    purpose: r.purpose,
    extras: parsedExtras.success ? parsedExtras.data : {},
  };
}

export async function saveTripContext(db: AnyDb, userId: string, tripId: string, input: z.input<typeof TripContextInput>): Promise<void> {
  await assertTripOwned(db, userId, tripId);
  const parsed = TripContextInput.parse(input);
  await db.insert(tripContext).values({
    tripId,
    travelingWithMinors: parsed.travelingWithMinors,
    drivingAtDestination: parsed.drivingAtDestination,
    carryingControlledMeds: parsed.carryingControlledMeds,
    purpose: parsed.purpose,
    extras: parsed.extras ?? {},
  }).onConflictDoUpdate({
    target: tripContext.tripId,
    set: {
      travelingWithMinors: parsed.travelingWithMinors,
      drivingAtDestination: parsed.drivingAtDestination,
      carryingControlledMeds: parsed.carryingControlledMeds,
      purpose: parsed.purpose,
      extras: parsed.extras ?? {},
      updatedAt: new Date(),
    },
  });
}

export async function getProfileAction(): Promise<PermanentProfile | null> {
  const { db } = await import('@/lib/db/client');
  const userId = await requireSession();
  return loadProfile(db, userId);
}

export async function saveProfileAction(input: z.input<typeof Tier1ProfileInput>): Promise<void> {
  const { db } = await import('@/lib/db/client');
  const userId = await requireSession();
  await saveProfile(db, userId, input);
}

export async function getTripContextAction(tripId: string): Promise<TripContext | null> {
  const { db } = await import('@/lib/db/client');
  const userId = await requireSession();
  await assertTripOwned(db, userId, tripId);
  return loadTripContext(db, tripId);
}

export async function saveTripContextAction(tripId: string, input: z.input<typeof TripContextInput>): Promise<void> {
  const { db } = await import('@/lib/db/client');
  const userId = await requireSession();
  await saveTripContext(db, userId, tripId, input);
}
