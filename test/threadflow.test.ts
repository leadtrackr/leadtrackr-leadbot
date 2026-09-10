import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config';
import { answerQuestion, channelChip, menuThread, openFaq } from '../src/ui/threadflow';

function config() {
  return resolveConfig('p1', {
    // expliciet, zodat de chip-teksten niet afhangen van het lang-attribuut
    // dat een ander testbestand heeft achtergelaten
    language: 'nl',
    greeting: 'Waar kan ik je mee helpen?',
    whatsapp: '+31612345678',
    phone: '+31 20 1234567',
    channels: ['faq', 'whatsapp', 'phone', 'contact_form'],
    faqs: {
      faq: {
        title: 'Veelgestelde vragen',
        intro: 'Waar kan ik je mee helpen?',
        questions: [
          { q: 'Openingstijden?', a: 'Kijk op de **winkelpagina**.', button: { label: 'Winkelpagina', url: '/winkels' } },
          { q: 'Levertijd?', a: 'Voor 23:00 besteld, morgen in huis.' },
        ],
        followUp: ['whatsapp', 'phone'],
      },
    },
  } as never);
}

describe('FAQ-gesprek', () => {
  it('opens with the intro and one chip per question', () => {
    const cfg = config();
    const s = openFaq(cfg, cfg.faqs.faq);
    expect(s.messages).toEqual([{ from: 'bot', text: 'Waar kan ik je mee helpen?' }]);
    expect(s.chips.map((c) => c.label)).toEqual(['Openingstijden?', 'Levertijd?']);
    expect(s.channel).toBe('faq');
  });

  it('echoes the question, then answers it with its button', () => {
    const cfg = config();
    const s = answerQuestion(cfg, cfg.faqs.faq, openFaq(cfg, cfg.faqs.faq), 0);
    expect(s.messages[1]).toEqual({ from: 'user', text: 'Openingstijden?' });
    expect(s.messages[2].from).toBe('bot');
    expect(s.messages[2].text).toContain('winkelpagina');
    expect(s.messages[2].button).toEqual({ label: 'Winkelpagina', url: '/winkels' });
  });

  it('offers the remaining questions plus the follow-up channels and a quiet closer', () => {
    const cfg = config();
    const s = answerQuestion(cfg, cfg.faqs.faq, openFaq(cfg, cfg.faqs.faq), 0);
    const ids = s.chips.map((c) => c.id);
    expect(ids).toContain('q1');
    expect(ids).not.toContain('q0');
    expect(ids).toContain('whatsapp');
    expect(ids).toContain('phone');
    expect(s.chips[s.chips.length - 1]).toEqual({
      id: 'restart',
      label: 'Iets anders bekijken',
      style: 'quiet',
    });
  });

  it('drops a question from the chips once it has been asked', () => {
    const cfg = config();
    const first = answerQuestion(cfg, cfg.faqs.faq, openFaq(cfg, cfg.faqs.faq), 0);
    const second = answerQuestion(cfg, cfg.faqs.faq, first, 1);
    const ids = second.chips.map((c) => c.id);
    expect(ids).not.toContain('q0');
    expect(ids).not.toContain('q1');
    expect(ids).toContain('whatsapp');
  });

  it('marks only the answer as new, so the rest of the thread stays still', () => {
    const cfg = config();
    expect(answerQuestion(cfg, cfg.faqs.faq, openFaq(cfg, cfg.faqs.faq), 0).fresh).toBe(1);
  });

  it('ignores a question index that does not exist', () => {
    const cfg = config();
    const opened = openFaq(cfg, cfg.faqs.faq);
    expect(answerQuestion(cfg, cfg.faqs.faq, opened, 99)).toBe(opened);
  });
});

describe('menuThread', () => {
  it('greets and turns every channel into a chip, WhatsApp featured', () => {
    const cfg = config();
    const s = menuThread(cfg);
    expect(s.channel).toBeNull();
    expect(s.messages).toEqual([{ from: 'bot', text: 'Waar kan ik je mee helpen?' }]);
    expect(s.chips.map((c) => c.id)).toEqual(['faq', 'whatsapp', 'phone', 'contact_form']);
    expect(s.chips.find((c) => c.id === 'whatsapp')!.style).toBe('featured');
  });
});

describe('channelChip', () => {
  it('labels each channel kind from its own definition', () => {
    const cfg = config();
    expect(channelChip(cfg, 'whatsapp')!.label).toBe('WhatsApp');
    expect(channelChip(cfg, 'phone')!.label).toBe(cfg.texts.callTitle);
    expect(channelChip(cfg, 'faq')!.label).toBe('Veelgestelde vragen');
    expect(channelChip(cfg, 'bestaat-niet')).toBeNull();
  });
});
