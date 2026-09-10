import { describe, expect, it } from 'vitest';
import { resolveChannel } from '../src/channels';
import { resolveConfig } from '../src/config';

const base = {
  phone: '+31 20 1234567',
  whatsapp: '+31612345678',
  channels: ['winkels', 'contact_form', 'phone', 'whatsapp'],
  links: {
    winkels: {
      title: 'Winkels',
      sub: 'Vind een winkel',
      icon: 'info' as const,
      message: '**Onze winkels**\n\nVind er een bij jou in de buurt.',
      button: { label: 'Zoek een winkel', url: '/winkels' },
    },
  },
};

describe('resolveChannel', () => {
  it('names the kind behind each channel id', () => {
    const cfg = resolveConfig('p1', base);
    expect(resolveChannel(cfg, 'winkels')!.kind).toBe('link');
    expect(resolveChannel(cfg, 'contact_form')!.kind).toBe('form');
    expect(resolveChannel(cfg, 'phone')!.kind).toBe('phone');
    expect(resolveChannel(cfg, 'whatsapp')!.kind).toBe('whatsapp');
    expect(resolveChannel(cfg, 'bestaat-niet')).toBeNull();
  });

  it('keeps a link channel in the panel', () => {
    expect(resolveConfig('p1', base).channels).toContain('winkels');
  });

  it('drops a link without a url, like a form without usable fields', () => {
    const cfg = resolveConfig('p1', {
      channels: ['kapot'],
      links: { kapot: { title: 'Kapot', button: { label: 'Ga', url: '' } } },
    } as never);
    expect(cfg.channels).toEqual([]);
    expect(resolveChannel(cfg, 'kapot')).toBeNull();
  });

  it('falls back to the id and to the title when title or button label are missing', () => {
    const cfg = resolveConfig('p1', {
      channels: ['winkels'],
      links: { winkels: { button: { url: '/winkels' } } },
    } as never);
    expect(cfg.links.winkels.title).toBe('winkels');
    expect(cfg.links.winkels.button.label).toBe('winkels');
    expect(cfg.links.winkels.icon).toBe('info');
  });

  it('lets a language layer translate a link without losing the rest', () => {
    document.documentElement.lang = 'de';
    const cfg = resolveConfig('p1', {
      ...base,
      byLanguage: { de: { links: { winkels: { title: 'Filialen', message: '**Unsere Filialen**' } } } },
    } as never);
    expect(cfg.links.winkels.title).toBe('Filialen');
    expect(cfg.links.winkels.message).toBe('**Unsere Filialen**');
    // niet vertaald, dus uit de basis
    expect(cfg.links.winkels.sub).toBe('Vind een winkel');
    expect(cfg.links.winkels.button.url).toBe('/winkels');
    expect(cfg.links.winkels.button.label).toBe('Zoek een winkel');
    document.documentElement.lang = 'nl';
  });

  it('lets a language layer point a link at another page', () => {
    document.documentElement.lang = 'de';
    const cfg = resolveConfig('p1', {
      ...base,
      byLanguage: { de: { links: { winkels: { button: { label: 'Filiale finden', url: '/filialen' } } } } },
    } as never);
    expect(cfg.links.winkels.button.url).toBe('/filialen');
    expect(cfg.links.winkels.title).toBe('Winkels');
    document.documentElement.lang = 'nl';
  });
});
