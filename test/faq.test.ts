import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config';

describe('faqs in de config', () => {
  it('keeps a usable faq as a channel', () => {
    const cfg = resolveConfig('p1', {
      channels: ['faq'],
      faqs: { faq: { title: 'Vragen', questions: [{ q: 'A?', a: 'B' }] } },
    } as never);
    expect(cfg.channels).toEqual(['faq']);
    expect(cfg.faqs.faq.questions).toHaveLength(1);
  });

  it('drops a faq without usable questions', () => {
    const cfg = resolveConfig('p1', {
      channels: ['faq'],
      faqs: { faq: { questions: [{ q: '', a: 'B' }, { q: 'A?', a: '' }] } },
    } as never);
    expect(cfg.channels).toEqual([]);
    expect(cfg.faqs.faq).toBeUndefined();
  });

  it('ignores a follow-up channel that is not available', () => {
    const cfg = resolveConfig('p1', {
      channels: ['faq'],
      faqs: { faq: { questions: [{ q: 'A?', a: 'B' }], followUp: ['whatsapp', 'bestaat-niet'] } },
    } as never);
    // zonder whatsapp-nummer bestaat dat kanaal niet, dus blijft er niets over
    expect(cfg.faqs.faq.followUp).toEqual([]);
  });

  it('keeps a follow-up channel that does exist', () => {
    const cfg = resolveConfig('p1', {
      whatsapp: '+31612345678',
      channels: ['faq', 'whatsapp'],
      faqs: { faq: { questions: [{ q: 'A?', a: 'B' }], followUp: ['whatsapp'] } },
    } as never);
    expect(cfg.faqs.faq.followUp).toEqual(['whatsapp']);
  });

  it('lets a language layer translate questions per index', () => {
    document.documentElement.lang = 'de';
    const cfg = resolveConfig('p1', {
      channels: ['faq'],
      faqs: { faq: { title: 'Vragen', questions: [{ q: 'Openingstijden?', a: 'Kijk op de site.' }] } },
      byLanguage: { de: { faqs: { faq: { title: 'Fragen', questions: [{ q: 'Öffnungszeiten?', a: 'Schauen Sie auf der Website.' }] } } } },
    } as never);
    expect(cfg.faqs.faq.title).toBe('Fragen');
    expect(cfg.faqs.faq.questions[0].q).toBe('Öffnungszeiten?');
    document.documentElement.lang = 'nl';
  });
});
