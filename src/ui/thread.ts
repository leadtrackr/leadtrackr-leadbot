import type { LeadBotConfig } from '../config';
import { icons } from './icons';
import { renderText } from './richtext';
import { avatar, brandFooter, esc } from './views';

export interface ThreadMessage {
  from: 'bot' | 'user';
  /** Bot-tekst mag opmaak bevatten; wat de bezoeker typt nooit. */
  text: string;
  button?: { label: string; url: string };
}

export interface ThreadChip {
  id: string;
  label: string;
  style?: 'featured' | 'quiet';
}

export interface ThreadState {
  /** Het kanaal dat dit gesprek voert; null als de thread het hoofdmenu is. */
  channel: string | null;
  messages: ThreadMessage[];
  chips: ThreadChip[];
  typing: boolean;
  /** False bij de eerste render van een nieuwe stap, zodat een animatie één
      keer speelt en niet opnieuw bij elke herrender — zelfde truc als de
      WhatsApp-view met `entered`. */
  entered: boolean;
}

function message(m: ThreadMessage): string {
  if (m.from === 'user') return `<div class="ltb-user">${esc(m.text)}</div>`;
  const button = m.button
    ? `<a class="ltb-cardbtn" href="${esc(m.button.url)}" data-action="card-link"><span>${esc(m.button.label)}</span>${icons.chevronRight(16)}</a>`
    : '';
  return `<div class="ltb-bot">${renderText(m.text)}${button}</div>`;
}

export function threadView(cfg: LeadBotConfig, s: ThreadState, opts: { back: boolean }): string {
  const t = cfg.texts;
  const body = s.messages.map(message).join('');
  const typing = s.typing
    ? '<div class="ltb-typing"><span></span><span></span><span></span></div>'
    : '';
  const chips = s.typing
    ? ''
    : `<div class="ltb-opts">${s.chips
        .map(
          (c) =>
            `<button type="button" class="ltb-opt${c.style ? ' ltb-opt--' + c.style : ''}" data-action="chip-${esc(c.id)}">${esc(c.label)}</button>`,
        )
        .join('')}</div>`;
  const back = opts.back
    ? `<button class="ltb-back" data-action="back" aria-label="${esc(t.back)}">${icons.back(18)}</button>`
    : '';
  return `
  <div class="ltb-handle"><span></span></div>
  <div class="ltb-wa-head">
    ${back}
    ${avatar(cfg, 'ltb-avatar-fallback')}
    <div>
      <p class="ltb-wa-head-name">${esc(cfg.agentName || cfg.companyName)}</p>
      <p class="ltb-wa-head-status">${esc(t.responseTime)}</p>
    </div>
    <button class="ltb-close" data-action="close" aria-label="${esc(t.close)}">${icons.close(15)}</button>
  </div>
  <div class="ltb-thread${s.entered ? ' ltb-static' : ''}" role="log" aria-live="polite">
    ${body}${typing}${chips}
  </div>
  ${brandFooter(cfg)}`;
}
