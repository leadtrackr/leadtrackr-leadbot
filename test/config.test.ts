import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_ENDPOINT, resolveConfig } from '../src/config';

describe('resolveConfig', () => {
  beforeEach(() => {
    document.documentElement.lang = 'nl';
  });

  it('applies defaults with only a projectId', () => {
    const cfg = resolveConfig('p1', undefined);
    expect(cfg.projectId).toBe('p1');
    expect(cfg.endpoint).toBe(DEFAULT_ENDPOINT);
    expect(cfg.position).toBe('right');
    expect(cfg.theme.primary).toBe('#52B483');
    expect(cfg.texts.submit).toBe('Verstuur bericht');
    expect(cfg.channels).toEqual(['contact_form']); // phone/whatsapp dropped without numbers
  });

  it('resolves language from the html lang attribute with English fallback', () => {
    expect(resolveConfig('p1', undefined).language).toBe('nl');
    document.documentElement.lang = 'en-US';
    const en = resolveConfig('p1', undefined);
    expect(en.language).toBe('en');
    expect(en.texts.submit).toBe('Send message');
    document.documentElement.lang = 'fr';
    expect(resolveConfig('p1', undefined).language).toBe('en');
    document.documentElement.lang = '';
    expect(resolveConfig('p1', undefined).language).toBe('en');
  });

  it('lets config.language override the page language', () => {
    document.documentElement.lang = 'en';
    expect(resolveConfig('p1', { language: 'nl' }).texts.submit).toBe('Verstuur bericht');
  });

  it('speaks as "I" with an agent and as "we" without one', () => {
    const personal = resolveConfig('p1', { agentName: 'Nick' });
    expect(personal.greeting).toBe('Goedendag 👋 Waar kan ik je mee helpen?');
    expect(personal.texts.successBody).toBe('Ik neem zo snel mogelijk contact met je op.');
    expect(personal.texts.msgSub).toBe('Ik reageer zo snel mogelijk');
    const company = resolveConfig('p1', undefined);
    expect(company.greeting).toBe('Goedendag 👋 Waar kunnen we je mee helpen?');
    expect(company.texts.successBody).toBe('We nemen zo snel mogelijk contact met je op.');
    const overridden = resolveConfig('p1', { agentName: 'Nick', texts: { msgSub: 'Custom' } as never });
    expect(overridden.texts.msgSub).toBe('Custom');
  });

  it('uses a localized default greeting and responseTime, both overridable', () => {
    const cfg = resolveConfig('p1', undefined);
    expect(cfg.greeting).toContain('Waar kunnen we je mee helpen');
    expect(cfg.texts.responseTime).toBe('Gemiddelde responstijd: binnen 15 minuten');
    const custom = resolveConfig('p1', {
      greeting: 'Hoi!',
      responseTimeText: 'Reactie binnen 1 uur',
    });
    expect(custom.greeting).toBe('Hoi!');
    expect(custom.texts.responseTime).toBe('Reactie binnen 1 uur');
  });

  it('keeps phone and whatsapp channels when numbers are configured', () => {
    const cfg = resolveConfig('p1', { phone: '+31 20 123 4567', whatsapp: '+31612345678' });
    expect(cfg.channels).toEqual(['contact_form', 'phone', 'whatsapp']);
  });

  it('respects channel order and subset from config', () => {
    const cfg = resolveConfig('p1', { phone: '+3120', channels: ['phone', 'contact_form'] });
    expect(cfg.channels).toEqual(['phone', 'contact_form']);
  });

  it('merges partial theme and texts over defaults', () => {
    const cfg = resolveConfig('p1', {
      theme: { primary: '#FF0000' } as never,
      texts: { submit: 'Send' } as never,
    });
    expect(cfg.theme.primary).toBe('#FF0000');
    expect(cfg.theme.primaryHover).toBe('#3E8762');
    expect(cfg.texts.submit).toBe('Send');
    expect(cfg.texts.nameLabel).toBe('Naam');
  });

  it('keeps formNames overridable per channel', () => {
    const cfg = resolveConfig('p1', { formNames: { contact_form: 'Custom' } as never });
    expect(cfg.formNames.contact_form).toBe('Custom');
    expect(cfg.formNames.whatsapp).toBe('LeadBot — WhatsApp');
  });

  it('keeps the WhatsApp phone question on unless it is explicitly false', () => {
    expect(resolveConfig('p1', undefined).whatsappPhoneQuestion).toBe(true);
    expect(resolveConfig('p1', {}).whatsappPhoneQuestion).toBe(true);
    expect(resolveConfig('p1', { whatsappPhoneQuestion: false }).whatsappPhoneQuestion).toBe(false);
    // Alleen een letterlijke false telt: een typefout mag de vraag niet stilletjes uitzetten
    const typo = resolveConfig('p1', { whatsappPhoneQuestion: 'false' as unknown as boolean });
    expect(typo.whatsappPhoneQuestion).toBe(true);
    const zero = resolveConfig('p1', { whatsappPhoneQuestion: 0 as unknown as boolean });
    expect(zero.whatsappPhoneQuestion).toBe(true);
  });

  it('keeps the subscription check on unless it is explicitly false', () => {
    expect(resolveConfig('p1', undefined).subscriptionCheck).toBe(true);
    expect(resolveConfig('p1', {}).subscriptionCheck).toBe(true);
    expect(resolveConfig('p1', { subscriptionCheck: false }).subscriptionCheck).toBe(false);
    const typo = resolveConfig('p1', { subscriptionCheck: 'false' as unknown as boolean });
    expect(typo.subscriptionCheck).toBe(true);
  });
});

describe('resolveConfig — forms', () => {
  beforeEach(() => {
    document.documentElement.lang = 'nl';
  });

  it('always resolves the built-in contact form', () => {
    const cfg = resolveConfig('p1', undefined);
    expect(cfg.forms.contact_form.fields.map((f) => f.key)).toEqual(['name', 'email', 'message']);
    expect(cfg.forms.contact_form.formName).toBe('LeadBot — Contact form');
  });

  it('keeps a configured form as its own channel', () => {
    const cfg = resolveConfig('p1', {
      channels: ['callback', 'contact_form'],
      forms: { callback: { title: 'Bel mij terug', fields: [{ key: 'phone', required: true }] } },
    });
    expect(cfg.channels).toEqual(['callback', 'contact_form']);
    expect(cfg.forms.callback.title).toBe('Bel mij terug');
  });

  it('drops a channel that is neither a form nor a reachable number', () => {
    const cfg = resolveConfig('p1', { channels: ['ghost', 'phone', 'whatsapp', 'contact_form'] });
    expect(cfg.channels).toEqual(['contact_form']);
  });

  it('passes formNames.contact_form through to the built-in form', () => {
    const cfg = resolveConfig('p1', { formNames: { contact_form: 'Eigen naam' } as never });
    expect(cfg.forms.contact_form.formName).toBe('Eigen naam');
  });

  it('lets forms.contact_form win over formNames.contact_form', () => {
    const cfg = resolveConfig('p1', {
      formNames: { contact_form: 'Oude naam' } as never,
      forms: { contact_form: { formName: 'Nieuwe naam' } },
    });
    expect(cfg.forms.contact_form.formName).toBe('Nieuwe naam');
  });
});

describe('resolveConfig — taal en taallaag', () => {
  beforeEach(() => {
    document.documentElement.lang = 'de';
  });

  it('serves the built-in German copy on a German page', () => {
    const cfg = resolveConfig('p1', undefined);
    expect(cfg.language).toBe('de');
    expect(cfg.texts.submit).toBe('Nachricht senden');
    expect(cfg.greeting).toBe('Guten Tag 👋 Wie können wir Ihnen helfen?');
  });

  it('applies the overlay of the detected language', () => {
    const cfg = resolveConfig('p1', {
      whatsapp: '+31620222407',
      channels: ['offerte', 'whatsapp'],
      forms: { offerte: { title: 'Offerte aanvragen', fields: [{ key: 'name', required: true }] } },
      byLanguage: { de: { forms: { offerte: { title: 'Angebot anfordern' } } } },
    });
    expect(cfg.forms.offerte.title).toBe('Angebot anfordern');
    expect(cfg.forms.offerte.fields[0].required).toBe(true);
    expect(cfg.channels).toEqual(['offerte', 'whatsapp']);
  });

  it('keeps the Dutch base on a Dutch page', () => {
    document.documentElement.lang = 'nl';
    const cfg = resolveConfig('p1', {
      forms: { offerte: { title: 'Offerte aanvragen', fields: [{ key: 'name' }] } },
      byLanguage: { de: { forms: { offerte: { title: 'Angebot anfordern' } } } },
    });
    expect(cfg.forms.offerte.title).toBe('Offerte aanvragen');
  });

  it('translates the form name so leads stay distinguishable per language', () => {
    const cfg = resolveConfig('p1', {
      forms: { offerte: { formName: 'LeadBot — Offerteaanvraag', fields: [{ key: 'name' }] } },
      byLanguage: { de: { forms: { offerte: { formName: 'LeadBot — Angebotsanfrage' } } } },
    });
    expect(cfg.forms.offerte.formName).toBe('LeadBot — Angebotsanfrage');
  });

  it('lets a language override the response time and the phone number', () => {
    const cfg = resolveConfig('p1', {
      phone: '+31 341 411 624',
      channels: ['phone'],
      responseTimeText: 'Gemiddelde responstijd: binnen 15 minuten',
      byLanguage: { de: { phone: '+49 30 123456', responseTimeText: 'Antwort innerhalb von 15 Minuten' } },
    });
    expect(cfg.phone).toBe('+49 30 123456');
    expect(cfg.texts.responseTime).toBe('Antwort innerhalb von 15 Minuten');
  });

  it('cannot be talked into another language by its own overlay', () => {
    const cfg = resolveConfig('p1', {
      byLanguage: { de: { language: 'nl' } as never },
    });
    expect(cfg.language).toBe('de');
    expect(cfg.texts.submit).toBe('Nachricht senden');
  });
});
