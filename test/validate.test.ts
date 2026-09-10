import { describe, expect, it } from 'vitest';
import { isValidEmail, isValidNumber, normalizePhone } from '../src/validate';

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

describe('isValidNumber', () => {
  it('accepts whole and decimal numbers, with a comma or a period', () => {
    expect(isValidNumber('250')).toBe(true);
    expect(isValidNumber('2.5')).toBe(true);
    expect(isValidNumber('2,5')).toBe(true);
    expect(isValidNumber('-3')).toBe(true);
    expect(isValidNumber(' 12 ')).toBe(true);
  });

  it('rejects anything that is not a number', () => {
    expect(isValidNumber('veel')).toBe(false);
    expect(isValidNumber('')).toBe(false);
    expect(isValidNumber('12stuks')).toBe(false);
    expect(isValidNumber('1.2.3')).toBe(false);
  });
});
