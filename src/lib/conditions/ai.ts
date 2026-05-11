import { generateObject } from 'ai';
import { z } from 'zod';
import { ROW_TYPES, type RowType, type RowOf } from './registry';

const Citation = z.object({
  url: z.string().url(),
  snippet: z.string().optional(),
  fetchedAt: z.string(),
});
export type Citation = z.infer<typeof Citation>;

export type AIRowResult<T extends RowType> = {
  data: RowOf<T>;
  confidence: 'high' | 'medium' | 'low';
  citations: Citation[];
};

const MODEL = process.env.CONDITIONS_AI_MODEL ?? 'anthropic/claude-opus-4-7';

export async function fetchRowViaAI<T extends RowType>(
  type: T,
  key: string,
): Promise<AIRowResult<T> | null> {
  const wrapped = ROW_TYPES[type].schema.and(z.object({
    confidence: z.enum(['high', 'medium', 'low']),
    citations: z.array(Citation),
  }));

  try {
    const { object } = await generateObject({
      model: MODEL,
      schema: wrapped,
      system: [
        'You produce structured factual answers about travel conditions between countries.',
        'Lower `confidence` if you are uncertain. Prefer authoritative sources (government, embassy, airline).',
        'If you cite a URL, include it in `citations`; use ISO timestamps in `fetchedAt`.',
      ].join(' '),
      prompt: `Return the ${type} row for key "${key}". Match the schema exactly.`,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Zod composite parse output; data extracted via rest spread
    const { confidence, citations, ...data } = object as any;
    return { data: data as RowOf<T>, confidence, citations };
  } catch (err) {
    console.error(`[conditions.ai] fetch failed for ${type}:${key}`, err);
    return null;
  }
}
