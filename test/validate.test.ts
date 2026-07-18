import { describe, expect, it } from 'vitest';
import { COUNTRIES, isValidEmail, normalizePhone } from '../src/validate';

describe('normalizePhone', () => {
  it('converts NL national formats to E.164', () => {
    expect(normalizePhone('06 12345678', '+31')).toBe('+31612345678');
    expect(normalizePhone('020-123 4567', '+31')).toBe('+31201234567');
  });

  it('keeps international formats and converts 00-prefix', () => {
    expect(normalizePhone('+32 470 12 34 56', '+31')).toBe('+32470123456');
    expect(normalizePhone('0032470123456', '+31')).toBe('+32470123456');
  });

  it('uses the given dial code for bare numbers', () => {
    expect(normalizePhone('470123456', '+32')).toBe('+32470123456');
  });

  it('rejects garbage and too-short numbers', () => {
    expect(normalizePhone('06 12', '+31')).toBeNull();
    expect(normalizePhone('abc', '+31')).toBeNull();
    expect(normalizePhone('', '+31')).toBeNull();
  });
});

describe('isValidEmail', () => {
  it('accepts normal addresses and rejects malformed ones', () => {
    expect(isValidEmail('jan@bedrijf.nl')).toBe(true);
    expect(isValidEmail('jan@bedrijf')).toBe(false);
    expect(isValidEmail('jan @bedrijf.nl')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('COUNTRIES', () => {
  it('starts with NL and contains dial codes', () => {
    expect(COUNTRIES[0].code).toBe('NL');
    expect(COUNTRIES[0].dial).toBe('+31');
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(8);
  });
});
