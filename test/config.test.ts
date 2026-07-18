import { describe, expect, it } from 'vitest';
import { DEFAULT_ENDPOINT, resolveConfig } from '../src/config';

describe('resolveConfig', () => {
  it('applies defaults with only a projectId', () => {
    const cfg = resolveConfig('p1', undefined);
    expect(cfg.projectId).toBe('p1');
    expect(cfg.endpoint).toBe(DEFAULT_ENDPOINT);
    expect(cfg.position).toBe('right');
    expect(cfg.theme.primary).toBe('#52B483');
    expect(cfg.texts.submit).toBe('Verstuur bericht');
    expect(cfg.channels).toEqual(['message']); // call/whatsapp dropped without numbers
  });

  it('keeps call and whatsapp channels when numbers are configured', () => {
    const cfg = resolveConfig('p1', { phone: '+31 20 123 4567', whatsapp: '+31612345678' });
    expect(cfg.channels).toEqual(['message', 'call', 'whatsapp']);
  });

  it('respects channel order and subset from config', () => {
    const cfg = resolveConfig('p1', { phone: '+3120', channels: ['call', 'message'] });
    expect(cfg.channels).toEqual(['call', 'message']);
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
    const cfg = resolveConfig('p1', { formNames: { message: 'Custom' } as never });
    expect(cfg.formNames.message).toBe('Custom');
    expect(cfg.formNames.whatsapp).toBe('Widget — WhatsApp');
  });
});
