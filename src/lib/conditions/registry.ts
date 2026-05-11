import { z } from 'zod';

export const ROW_TYPES = {
  visa_exemption: {
    schema: z.object({
      exemptDays: z.number().int().nullable(),
      notes: z.string().optional(),
    }).strict(),
    keyFormat: 'citizenship:destination' as const,
    ttlDays: 180,
  },
  med_import: {
    schema: z.object({
      allowed: z.array(z.string()),
      permitRequired: z.array(z.string()),
      banned: z.array(z.string()),
      permitName: z.string().optional(),
    }).strict(),
    keyFormat: 'destination' as const,
    ttlDays: 90,
  },
  driving: {
    schema: z.object({
      idpConvention: z.enum(['1949', '1968']).nullable(),
      notes: z.string().optional(),
    }).strict(),
    keyFormat: 'destination' as const,
    ttlDays: 365,
  },
} as const;

export type RowType = keyof typeof ROW_TYPES;
export type RowOf<T extends RowType> = z.infer<typeof ROW_TYPES[T]['schema']>;
