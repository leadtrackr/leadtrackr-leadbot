import { describe, expect, it } from 'vitest';
import { detectLanguage, TEXTS } from '../src/i18n';

describe('detectLanguage', () => {
  it('detects supported base languages, ignoring region', () => {
    expect(detectLanguage('nl')).toBe('nl');
    expect(detectLanguage('nl-BE')).toBe('nl');
    expect(detectLanguage('EN-US')).toBe('en');
  });

  it('falls back to English for missing or unsupported languages', () => {
    expect(detectLanguage('')).toBe('en');
    expect(detectLanguage(null)).toBe('en');
    expect(detectLanguage(undefined)).toBe('en');
    expect(detectLanguage('fr')).toBe('en');
  });
});

describe('TEXTS', () => {
  it('has identical keys for every language', () => {
    expect(Object.keys(TEXTS.nl).sort()).toEqual(Object.keys(TEXTS.en).sort());
  });

  it('contains the corrected WhatsApp and response-time copy (NL)', () => {
    expect(TEXTS.nl.waPhoneQuestion).toBe('Op welk telefoonnummer wil je het WhatsApp-gesprek starten?');
    expect(TEXTS.nl.waSuccessBody).toContain('nieuw tabblad');
    expect(TEXTS.nl.responseTime).toBe('Gemiddelde responstijd: binnen 15 minuten');
    expect(TEXTS.nl.responseTime).not.toContain('direct');
  });
});
