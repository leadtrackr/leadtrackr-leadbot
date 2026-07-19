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
});
