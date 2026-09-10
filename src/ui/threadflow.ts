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
    entered: false,
  };
}

/**
 * Terug naar het menu binnen een lopend gesprek. De berichten blijven staan —
 * een gesprek is een verslag, en dat opnieuw beginnen zou de bezoeker zijn
 * eigen vragen en antwoorden afnemen.
 */
export function backToMenu(cfg: LeadBotConfig, state: ThreadState): ThreadState {
  return { ...state, channel: null, chips: menuChips(cfg), typing: false, entered: false };
}

export function openFaq(cfg: LeadBotConfig, def: FaqDef): ThreadState {
  return {
    channel: def.id,
    messages: [{ from: 'bot', text: def.intro }],
    chips: def.questions.map((q, i) => ({ id: 'q' + i, label: q.q })),
    typing: false,
    entered: false,
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
  const asked = state.messages
    .filter((m) => m.from === 'user')
    .map((m) => m.text)
    .concat(q.q);
  // Een gestelde vraag komt niet terug in de chips; wat overblijft wel, met de
  // doorloopkanalen eronder en één rustige afsluiter. Het hele menu opnieuw
  // tonen werd te druk.
  const remaining = def.questions
    .map((question, i) => ({ question, i }))
    .filter(({ question }) => asked.indexOf(question.q) === -1)
    .map(({ question, i }) => ({ id: 'q' + i, label: question.q }));
  const followUp = def.followUp
    .map((id) => channelChip(cfg, id))
    .filter((c): c is ThreadChip => c !== null);
  return {
    ...state,
    messages: [
      ...state.messages,
      { from: 'user', text: q.q },
      { from: 'bot', text: q.a, ...(q.button ? { button: q.button } : {}) },
    ],
    chips: [...remaining, ...followUp, { id: 'restart', label: cfg.texts.threadRestart, style: 'quiet' }],
    typing: false,
    entered: false,
  };
}
