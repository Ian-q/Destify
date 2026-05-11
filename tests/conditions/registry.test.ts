import { describe, it, expect } from 'vitest';
import { ROW_TYPES } from '@/lib/conditions/registry';

describe('ROW_TYPES.visa_exemption', () => {
  it('accepts a valid row', () => {
    const r = ROW_TYPES.visa_exemption.schema.safeParse({ exemptDays: 90, notes: 'tourist' });
    expect(r.success).toBe(true);
  });
  it('accepts exemptDays=null (visa required)', () => {
    expect(ROW_TYPES.visa_exemption.schema.safeParse({ exemptDays: null }).success).toBe(true);
  });
  it('rejects non-integer days', () => {
    expect(ROW_TYPES.visa_exemption.schema.safeParse({ exemptDays: 90.5 }).success).toBe(false);
  });
});

describe('ROW_TYPES.med_import', () => {
  it('requires three arrays', () => {
    expect(ROW_TYPES.med_import.schema.safeParse({
      allowed: [], permitRequired: [], banned: [],
    }).success).toBe(true);
  });
});

describe('ROW_TYPES.driving', () => {
  it('accepts a 1949 convention', () => {
    expect(ROW_TYPES.driving.schema.safeParse({ idpConvention: '1949' }).success).toBe(true);
  });
  it('rejects an unknown convention', () => {
    expect(ROW_TYPES.driving.schema.safeParse({ idpConvention: '1968-supplemental' }).success).toBe(false);
  });
});
