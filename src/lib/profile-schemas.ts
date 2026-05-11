import { z } from 'zod';
import { ProfileExtras, TripContextExtras } from '@/lib/profile-extras';

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
