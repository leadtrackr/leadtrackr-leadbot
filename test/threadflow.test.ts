import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config';
import { answerQuestion, askFaq, channelChip, faqOther, menuThread, openFaq } from '../src/ui/threadflow';

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
  it('opens with the intro, a chip per question and the way out', () => {
    const cfg = config();
    const s = openFaq(cfg, cfg.faqs.faq);
    expect(s.messages).toEqual([{ from: 'bot', text: 'Waar kan ik je mee helpen?' }]);
    expect(s.chips.map((c) => c.label)).toEqual([
      'Openingstijden?',
      'Levertijd?',
      'Ik heb een andere vraag',
    ]);
    expect(s.channel).toBe('faq');
  });

  it('leaves out the way out when there is nowhere to go', () => {
    const cfg = resolveConfig('p1', {
      language: 'nl',
      channels: ['faq'],
      faqs: { faq: { questions: [{ q: 'A?', a: 'B' }] } },
    } as never);
    expect(openFaq(cfg, cfg.faqs.faq).chips.map((c) => c.id)).toEqual(['q0']);
  });

  it('adds the question list to a running conversation instead of restarting it', () => {
    const cfg = config();
    const running = menuThread(cfg);
    const s = askFaq(cfg, cfg.faqs.faq, running);
    expect(s.messages).toHaveLength(2);
    expect(s.messages[0]).toEqual(running.messages[0]);
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

  it('offers exactly two quiet choices after an answer', () => {
    const cfg = config();
    const s = answerQuestion(cfg, cfg.faqs.faq, openFaq(cfg, cfg.faqs.faq), 0);
    expect(s.chips).toEqual([
      { id: 'faq-again', label: 'Nog een vraag', style: 'quiet' },
      { id: 'restart', label: 'Iets anders bekijken', style: 'quiet' },
    ]);
  });

  it('offers the lead channels behind "another question", WhatsApp featured', () => {
    const cfg = config();
    const s = faqOther(cfg, cfg.faqs.faq, openFaq(cfg, cfg.faqs.faq));
    expect(s.messages[s.messages.length - 2]).toEqual({ from: 'user', text: 'Ik heb een andere vraag' });
    expect(s.messages[s.messages.length - 1].text).toContain('Hoe wil je je vraag stellen?');
    expect(s.chips.map((c) => c.id)).toEqual(['whatsapp', 'phone']);
    expect(s.chips[0].style).toBe('featured');
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
