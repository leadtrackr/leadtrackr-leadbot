import type { LeadBotConfig } from '../config';
import type { FaqDef } from '../faq';
import type { ThreadChip, ThreadState } from './thread';

/**
 * De gesprekslogica staat bewust los van de rendering: welk bericht volgt op
 * welke keuze is pure state-in, state-uit, en daardoor te testen zonder DOM.
 */

/** Het label waarmee een kanaal zich in een gesprek aandient. */
export function channelChip(cfg: LeadBotConfig, id: string): ThreadChip | null {
  if (id === 'whatsapp') return cfg.whatsapp ? { id, label: cfg.texts.waTitle } : null;
  if (id === 'phone') return cfg.phone || cfg.callTracking ? { id, label: cfg.texts.callTitle } : null;
  const form = cfg.forms[id];
  if (form) return { id, label: form.title };
  const link = cfg.links[id];
  if (link) return { id, label: link.title };
  const faq = cfg.faqs[id];
  return faq ? { id, label: faq.title } : null;
}

/** De kanalen als keuzechips, in de volgorde van `channels`. */
export function menuChips(cfg: LeadBotConfig): ThreadChip[] {
  return cfg.channels
    .map((id) => channelChip(cfg, id))
    .filter((c): c is ThreadChip => c !== null)
    // WhatsApp is het kanaal met de hoogste doorstroom en staat daarom uitgelicht.
    .map((c) => (c.id === 'whatsapp' ? { ...c, style: 'featured' as const } : c));
}

/** Het hoofdmenu als gesprek: een begroeting met een chip per kanaal. */
export function menuThread(cfg: LeadBotConfig): ThreadState {
  return {
    channel: null,
    messages: [{ from: 'bot', text: cfg.greeting }],
    chips: menuChips(cfg),
    typing: false,
    fresh: 1,
  };
}

/**
 * Terug naar het menu binnen een lopend gesprek. De berichten blijven staan —
 * een gesprek is een verslag, en dat opnieuw beginnen zou de bezoeker zijn
 * eigen vragen en antwoorden afnemen.
 */
export function backToMenu(cfg: LeadBotConfig, state: ThreadState): ThreadState {
  return { ...state, channel: null, chips: menuChips(cfg), typing: false, fresh: 0 };
}

/**
 * De vragenlijst tonen binnen een lopend gesprek. Onderaan staat de doorloop
 * als eigen keuze — niet onder elk antwoord, want dan verdrinkt het antwoord
 * onder de knoppen.
 */
export function askFaq(cfg: LeadBotConfig, def: FaqDef, state: ThreadState): ThreadState {
  const chips: ThreadChip[] = def.questions.map((q, i) => ({ id: 'q' + i, label: q.q }));
  if (def.followUp.length) chips.push({ id: 'faq-other', label: cfg.texts.faqOther });
  return {
    ...state,
    channel: def.id,
    messages: [...state.messages, { from: 'bot', text: def.intro }],
    chips,
    typing: false,
    fresh: 1,
  };
}

/** De FAQ als eigen gesprek, zoals wanneer je hem vanuit de kanalenlijst opent. */
export function openFaq(cfg: LeadBotConfig, def: FaqDef): ThreadState {
  return askFaq(cfg, def, { channel: def.id, messages: [], chips: [], typing: false, fresh: 0 });
}

/**
 * "Ik heb een andere vraag": de bot biedt de kanalen aan waar wél een lead uit
 * komt. WhatsApp uitgelicht, net als in het menu.
 */
export function faqOther(cfg: LeadBotConfig, def: FaqDef, state: ThreadState): ThreadState {
  return {
    ...state,
    messages: [
      ...state.messages,
      { from: 'user', text: cfg.texts.faqOther },
      { from: 'bot', text: cfg.texts.faqOtherIntro },
    ],
    chips: def.followUp
      .map((id) => channelChip(cfg, id))
      .filter((c): c is ThreadChip => c !== null)
      .map((c) => (c.id === 'whatsapp' ? { ...c, style: 'featured' as const } : c)),
    typing: false,
    fresh: 1,
  };
}

export function answerQuestion(
  cfg: LeadBotConfig,
  def: FaqDef,
  state: ThreadState,
  index: number,
): ThreadState {
  const q = def.questions[index];
  if (!q) return state;
  // Na een antwoord alleen twee rustige keuzes: nog een vraag, of iets anders.
  // De hele vragenlijst er weer onder plakken maakt het antwoord onleesbaar.
  return {
    ...state,
    messages: [
      ...state.messages,
      { from: 'user', text: q.q },
      { from: 'bot', text: q.a, ...(q.button ? { button: q.button } : {}) },
    ],
    chips: [
      { id: 'faq-again', label: cfg.texts.threadAnotherQuestion, style: 'quiet' },
      { id: 'restart', label: cfg.texts.threadRestart, style: 'quiet' },
    ],
    typing: false,
    // alleen het antwoord is nieuw; de vraag stond er al
    fresh: 1,
  };
}
