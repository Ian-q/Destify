import 'server-only';

import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { permanentProfile, tripContext, trip } from '@/lib/db/schema';
import { ProfileExtras, TripContextExtras } from '@/lib/profile-extras';
import { Tier1ProfileInput, TripContextInput } from '@/lib/profile-schemas';
import type { PermanentProfile, TripContext, Residence } from '@/lib/user-profile';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

function readResidence(country: string | null, status: string | null): Residence | null {
  if (!country) return null;
  const allowed = ['tourist', 'permanent', 'digital-nomad', 'work', 'other'] as const;
  const visaStatus = status && (allowed as readonly string[]).includes(status)
    ? (status as Residence['visaStatus'])
    : null;
  return { country, visaStatus };
}

export async function loadProfile(db: AnyDb, userId: string): Promise<PermanentProfile | null> {
  const rows = await db.select().from(permanentProfile).where(eq(permanentProfile.userId, userId));
  if (rows.length === 0) return null;
  const r = rows[0];
  const parsedExtras = ProfileExtras.safeParse(r.extras);
  return {
    userId: r.userId,
    citizenships: Array.isArray(r.citizenships) ? r.citizenships : [],
    residence: readResidence(r.residenceCountry, r.residenceVisaStatus),
    idpConvention: r.idpConvention,
    idpExpiry: r.idpExpiry,
    controlledMeds: r.controlledMeds ?? [],
    hasMinors: r.hasMinors,
    extras: parsedExtras.success ? parsedExtras.data : {},
  };
}

export async function saveProfile(db: AnyDb, userId: string, input: z.input<typeof Tier1ProfileInput>): Promise<void> {
  const parsed = Tier1ProfileInput.parse(input);
  const values = {
    userId,
    citizenships: parsed.citizenships,
    residenceCountry: parsed.residence?.country ?? null,
    residenceVisaStatus: parsed.residence?.visaStatus ?? null,
    idpConvention: parsed.idpConvention,
    idpExpiry: parsed.idpExpiry,
    controlledMeds: parsed.controlledMeds,
    hasMinors: parsed.hasMinors,
    extras: parsed.extras ?? {},
  };
  await db.insert(permanentProfile).values(values).onConflictDoUpdate({
    target: permanentProfile.userId,
    set: {
      citizenships: values.citizenships,
      residenceCountry: values.residenceCountry,
      residenceVisaStatus: values.residenceVisaStatus,
      idpConvention: values.idpConvention,
      idpExpiry: values.idpExpiry,
      controlledMeds: values.controlledMeds,
      hasMinors: values.hasMinors,
      extras: values.extras,
      updatedAt: new Date(),
    },
  });
}

export async function assertTripOwned(db: AnyDb, userId: string, tripId: string): Promise<void> {
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
