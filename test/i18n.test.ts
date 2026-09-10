import { describe, expect, it } from 'vitest';
import { detectLanguage, PERSONAL_TEXTS, SUPPORTED_LANGUAGES, TEXTS } from '../src/i18n';

describe('detectLanguage', () => {
  it('detects supported base languages, ignoring region', () => {
    expect(detectLanguage('nl')).toBe('nl');
    expect(detectLanguage('nl-BE')).toBe('nl');
    expect(detectLanguage('EN-US')).toBe('en');
  });

  it('detects German, including regional variants', () => {
    expect(detectLanguage('de')).toBe('de');
    expect(detectLanguage('de-AT')).toBe('de');
    expect(detectLanguage('DE-CH')).toBe('de');
  });

  it('falls back to English for missing or unsupported languages', () => {
    expect(detectLanguage('')).toBe('en');
    expect(detectLanguage(null)).toBe('en');
    expect(detectLanguage(undefined)).toBe('en');
    expect(detectLanguage('fr')).toBe('en');
  });
});

describe('TEXTS', () => {
  it('has identical keys for every supported language', () => {
    const reference = Object.keys(TEXTS.en).sort();
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(Object.keys(TEXTS[lang]).sort(), `keys for ${lang}`).toEqual(reference);
    }
  });

  it('has no empty string in any language', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const [key, value] of Object.entries(TEXTS[lang])) {
        expect(value.length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('contains the corrected WhatsApp and response-time copy (NL)', () => {
    expect(TEXTS.nl.waPhoneQuestion).toBe('Op welk telefoonnummer wil je het WhatsApp-gesprek starten?');
    expect(TEXTS.nl.waSuccessBody).toContain('nieuw tabblad');
    expect(TEXTS.nl.responseTime).toBe('Gemiddelde responstijd: binnen 15 minuten');
    expect(TEXTS.nl.responseTime).not.toContain('direct');
  });

  it('addresses German visitors formally, in the "we" voice', () => {
    expect(TEXTS.de.messagePlaceholder).toBe('Wie können wir Ihnen helfen?');
    expect(TEXTS.de.callTitle).toBe('Rufen Sie uns an');
    expect(TEXTS.de.submit).toBe('Nachricht senden');
    expect(TEXTS.de.waSuccessBody).toContain('neuen Tab');
  });

  it('never addresses German visitors informally', () => {
    const informal = /\b(du|dich|dir|dein|deine|deinem|deiner)\b/i;
    for (const [key, value] of Object.entries(TEXTS.de)) {
      expect(informal.test(value), `${key}: ${value}`).toBe(false);
    }
  });
});

describe('PERSONAL_TEXTS', () => {
  it('overrides the same keys for every supported language', () => {
    const reference = Object.keys(PERSONAL_TEXTS.en).sort();
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(Object.keys(PERSONAL_TEXTS[lang]).sort(), `personal keys for ${lang}`).toEqual(reference);
    }
  });

  it('switches the German copy to the "I" voice', () => {
    expect(PERSONAL_TEXTS.de.callTitle).toBe('Rufen Sie mich an');
    expect(PERSONAL_TEXTS.de.messagePlaceholder).toBe('Wie kann ich Ihnen helfen?');
  });
});
