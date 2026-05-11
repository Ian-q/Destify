import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

import { generateObject } from 'ai';
import { fetchRowViaAI } from '@/lib/conditions/ai';

const mockGen = generateObject as unknown as ReturnType<typeof vi.fn>;

describe('fetchRowViaAI', () => {
  beforeEach(() => { mockGen.mockReset(); });

  it('returns parsed row + confidence + citations on success', async () => {
    mockGen.mockResolvedValueOnce({
      object: {
        exemptDays: 30,
        confidence: 'high',
        citations: [{ url: 'https://example.gov/visa', fetchedAt: '2026-05-10T00:00:00Z' }],
      },
    });
    const r = await fetchRowViaAI('visa_exemption', 'US:XX');
    expect(r).not.toBeNull();
    expect(r!.data.exemptDays).toBe(30);
    expect(r!.confidence).toBe('high');
    expect(r!.citations).toHaveLength(1);
  });

  it('returns null on generateObject throwing', async () => {
    mockGen.mockRejectedValueOnce(new Error('gateway 500'));
    const r = await fetchRowViaAI('visa_exemption', 'US:XX');
    expect(r).toBeNull();
  });
});
