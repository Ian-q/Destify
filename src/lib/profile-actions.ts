'use server';

import type { z } from 'zod';
import type { Tier1ProfileInput, TripContextInput } from '@/lib/profile-schemas';
import type { PermanentProfile, TripContext } from '@/lib/user-profile';
import { requireSession } from '@/lib/session';
import {
  loadProfile,
  saveProfile,
  loadTripContext,
  saveTripContext,
  assertTripOwned,
} from '@/lib/profile-db';
import { db } from '@/lib/db/client';

export async function getProfileAction(): Promise<PermanentProfile | null> {
  const userId = await requireSession();
  return loadProfile(db, userId);
}

export async function saveProfileAction(input: z.input<typeof Tier1ProfileInput>): Promise<void> {
  const userId = await requireSession();
  await saveProfile(db, userId, input);
}

export async function getTripContextAction(tripId: string): Promise<TripContext | null> {
  const userId = await requireSession();
  await assertTripOwned(db, userId, tripId);
  return loadTripContext(db, tripId);
}

export async function saveTripContextAction(tripId: string, input: z.input<typeof TripContextInput>): Promise<void> {
  const userId = await requireSession();
  await saveTripContext(db, userId, tripId, input);
}
