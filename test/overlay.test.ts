import { describe, expect, it } from 'vitest';
import { applyLanguageOverlay } from '../src/overlay';
import type { UserConfig } from '../src/config';

const base: UserConfig = {
  companyName: 'Van Delft',
  greeting: 'Goedendag, waar kan ik je mee helpen?',
  phone: '+31 341 411 624',
  channels: ['offerte', 'phone'],
  texts: { submit: 'Verstuur bericht', close: 'Sluiten' } as never,
  forms: {
    offerte: {
      title: 'Offerte aanvragen',
      submit: 'Offerte aanvragen',
      formName: 'LeadBot — Offerteaanvraag',
      fields: [
        { key: 'name', required: true },
        { key: 'aantal', label: 'Aantal producten', required: true, placeholder: 'Bijv. 250' },
        { key: 'message', type: 'textarea' },
      ],
    },
    bestelling: { title: 'Vraag over bestelling', fields: [{ key: 'name', required: true }] },
  },
  byLanguage: {
    de: {
      greeting: 'Guten Tag, wie kann ich Ihnen helfen?',
      texts: { submit: 'Nachricht senden' } as never,
      forms: {
        offerte: {
          title: 'Angebot anfordern',
          formName: 'LeadBot — Angebotsanfrage',
          fields: [{ key: 'aantal', label: 'Anzahl Produkte', placeholder: 'z. B. 250' }],
        },
      },
    },
  },
};

describe('applyLanguageOverlay', () => {
  it('returns the config untouched when there is no overlay', () => {
    const cfg: UserConfig = { greeting: 'Hoi' };
    expect(applyLanguageOverlay(cfg, 'de')).toEqual(cfg);
  });

  it('handles an absent config', () => {
    expect(applyLanguageOverlay(undefined, 'de')).toBeUndefined();
  });

  it('ignores an overlay for a different language', () => {
    const nl = applyLanguageOverlay(base, 'nl')!;
    expect(nl.greeting).toBe('Goedendag, waar kan ik je mee helpen?');
    expect(nl.forms!.offerte.title).toBe('Offerte aanvragen');
  });

  it('replaces a scalar for the matching language', () => {
    expect(applyLanguageOverlay(base, 'de')!.greeting).toBe('Guten Tag, wie kann ich Ihnen helfen?');
  });

  it('merges texts key by key, keeping the keys the overlay omits', () => {
    const texts = applyLanguageOverlay(base, 'de')!.texts as unknown as Record<string, string>;
    expect(texts.submit).toBe('Nachricht senden');
    expect(texts.close).toBe('Sluiten');
  });

  it('merges a form by id, keeping the properties the overlay omits', () => {
    const form = applyLanguageOverlay(base, 'de')!.forms!.offerte;
    expect(form.title).toBe('Angebot anfordern');
    expect(form.formName).toBe('LeadBot — Angebotsanfrage');
    expect(form.submit).toBe('Offerte aanvragen'); // niet vertaald, dus uit de basis
  });

  it('merges fields by key without losing type, required or order', () => {
    const fields = applyLanguageOverlay(base, 'de')!.forms!.offerte.fields!;
    expect(fields.map((f) => f.key)).toEqual(['name', 'aantal', 'message']);
    expect(fields[1].label).toBe('Anzahl Produkte');
    expect(fields[1].placeholder).toBe('z. B. 250');
    expect(fields[1].required).toBe(true);
    expect(fields[2].type).toBe('textarea');
  });

  it('leaves a form the overlay does not mention alone', () => {
    expect(applyLanguageOverlay(base, 'de')!.forms!.bestelling.title).toBe('Vraag over bestelling');
  });

  it('appends a field that the base form does not have', () => {
    const cfg: UserConfig = {
      forms: { f: { fields: [{ key: 'name' }] } },
      byLanguage: { de: { forms: { f: { fields: [{ key: 'ustid', label: 'USt-IdNr.' }] } } } },
    };
    const fields = applyLanguageOverlay(cfg, 'de')!.forms!.f.fields!;
    expect(fields.map((f) => f.key)).toEqual(['name', 'ustid']);
    expect(fields[1].label).toBe('USt-IdNr.');
  });

  it('lets the overlay set a country-specific phone number', () => {
    const cfg: UserConfig = { phone: '+31 341 411 624', byLanguage: { de: { phone: '+49 30 123456' } } };
    expect(applyLanguageOverlay(cfg, 'de')!.phone).toBe('+49 30 123456');
  });

  it('never leaves a byLanguage key in the merged result', () => {
    expect(applyLanguageOverlay(base, 'de')!.byLanguage).toBeUndefined();
  });

  it('does not mutate the config it is given', () => {
    applyLanguageOverlay(base, 'de');
    expect(base.greeting).toBe('Goedendag, waar kan ik je mee helpen?');
    expect(base.forms!.offerte.title).toBe('Offerte aanvragen');
    expect(base.forms!.offerte.fields![1].label).toBe('Aantal producten');
  });
});
