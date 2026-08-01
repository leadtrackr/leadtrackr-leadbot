import { afterEach, describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config';
import { regionFromLocale } from '../src/countries';
import { parseWaLink } from '../src/interceptor';

describe('parseWaLink', () => {
  it('parses wa.me links with number and text', () => {
    expect(parseWaLink('https://wa.me/31612345678?text=Hoi%20daar')).toEqual({
      phone: '31612345678',
      text: 'Hoi daar',
    });
    expect(parseWaLink('https://wa.me/+31612345678')).toEqual({ phone: '31612345678', text: '' });
  });

  it('parses wa.me without number (fallback to config happens later)', () => {
    expect(parseWaLink('https://wa.me/')).toEqual({ phone: '', text: '' });
  });

  it('parses api.whatsapp.com and web.whatsapp.com send links', () => {
    expect(parseWaLink('https://api.whatsapp.com/send?phone=31698765432&text=Hallo')).toEqual({
      phone: '31698765432',
      text: 'Hallo',
    });
    expect(parseWaLink('https://web.whatsapp.com/send?phone=31698765432')).toEqual({
      phone: '31698765432',
      text: '',
    });
  });

  it('parses whatsapp:// protocol links', () => {
    expect(parseWaLink('whatsapp://send?phone=31612345678&text=Hi')).toEqual({
      phone: '31612345678',
      text: 'Hi',
    });
  });

  it('leaves group, shortcode and unrelated links alone', () => {
    expect(parseWaLink('https://chat.whatsapp.com/ABCDEF123')).toBeNull();
    expect(parseWaLink('https://wa.me/message/QRCODE123')).toBeNull();
    expect(parseWaLink('https://api.whatsapp.com/other')).toBeNull();
    expect(parseWaLink('https://example.com/wa.me/31612345678')).toBeNull();
    expect(parseWaLink('tel:+31612345678')).toBeNull();
    expect(parseWaLink('/contact')).toBeNull();
  });
});

describe('resolveConfig — launcher + interceptor + landdetectie', () => {
  afterEach(() => {
    // navigator.language terug naar default van happy-dom
    Reflect.deleteProperty(window.navigator, 'language');
  });

  it('defaults: launcher aan, interceptor uit', () => {
    const cfg = resolveConfig('p', {});
    expect(cfg.launcher).toBe(true);
    expect(cfg.whatsappInterceptor).toBe(false);
  });

  it('respects launcher:false and whatsappInterceptor:true', () => {
    const cfg = resolveConfig('p', { launcher: false, whatsappInterceptor: true });
    expect(cfg.launcher).toBe(false);
    expect(cfg.whatsappInterceptor).toBe(true);
  });

  it('has a distinguishable interceptor formName that stays overridable', () => {
    expect(resolveConfig('p', {}).formNames.whatsapp_interceptor).toBe(
      'LeadBot — WhatsApp Interceptor',
    );
    const custom = resolveConfig('p', {
      formNames: { whatsapp_interceptor: 'Anders' } as never,
    });
    expect(custom.formNames.whatsapp_interceptor).toBe('Anders');
    expect(custom.formNames.whatsapp).toBe('LeadBot — WhatsApp');
  });

  it('derives defaultCountry from the browser locale region', () => {
    Object.defineProperty(window.navigator, 'language', { value: 'nl-BE', configurable: true });
    expect(resolveConfig('p', {}).defaultCountry).toBe('BE');
  });

  it('explicit defaultCountry wins over the browser locale', () => {
    Object.defineProperty(window.navigator, 'language', { value: 'de-DE', configurable: true });
    expect(resolveConfig('p', { defaultCountry: 'NL' }).defaultCountry).toBe('NL');
  });

  it('falls back to NL when the locale has no usable region', () => {
    Object.defineProperty(window.navigator, 'language', { value: 'nl', configurable: true });
    expect(resolveConfig('p', {}).defaultCountry).toBe('NL');
  });
});

describe('regionFromLocale', () => {
  it('extracts known regions', () => {
    expect(regionFromLocale('nl-BE')).toBe('BE');
    expect(regionFromLocale('de-DE')).toBe('DE');
    expect(regionFromLocale('en-us')).toBe('US');
    expect(regionFromLocale('zh-Hans-CN')).toBe('CN');
  });

  it('returns null for bare languages, unknown regions and junk', () => {
    expect(regionFromLocale('nl')).toBeNull();
    expect(regionFromLocale('en-XZ')).toBeNull();
    expect(regionFromLocale('')).toBeNull();
    expect(regionFromLocale(null)).toBeNull();
  });
});
