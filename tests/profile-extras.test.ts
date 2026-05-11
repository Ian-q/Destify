import { describe, it, expect } from 'vitest';
import { ProfileExtras, TripContextExtras } from '@/lib/profile-extras';

describe('ProfileExtras', () => {
  it('accepts an empty object', () => {
    expect(ProfileExtras.safeParse({}).success).toBe(true);
  });

  it('accepts cards and pointsProgs', () => {
    const r = ProfileExtras.safeParse({
      cards: [{ network: 'amex', tier: 'platinum', benefits: ['lounge'] }],
      pointsProgs: [{ program: 'star-alliance' }],
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown top-level keys (strict)', () => {
    expect(ProfileExtras.safeParse({ unknownKey: 'x' }).success).toBe(false);
  });
});

describe('TripContextExtras', () => {
  it('accepts an empty object', () => {
    expect(TripContextExtras.safeParse({}).success).toBe(true);
  });
  it('accepts accommodation', () => {
    expect(TripContextExtras.safeParse({ accommodation: 'hotel' }).success).toBe(true);
  });
});
