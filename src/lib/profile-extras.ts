import { z } from 'zod';

export const ProfileExtras = z.object({
  cards: z.array(z.object({
    network: z.string(),
    tier: z.string(),
    benefits: z.array(z.string()).optional(),
  })).optional(),
  pointsProgs: z.array(z.object({
    program: z.string(),
    tier: z.string().optional(),
  })).optional(),
  dietary: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  mobility: z.array(z.string()).optional(),
}).strict();
export type ProfileExtras = z.infer<typeof ProfileExtras>;

export const TripContextExtras = z.object({
  accommodation: z.string().optional(),
}).strict();
export type TripContextExtras = z.infer<typeof TripContextExtras>;
