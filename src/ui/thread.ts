import type { LeadBotConfig } from '../config';
import { icons } from './icons';
import { renderText } from './richtext';
import { agentLine, avatar, brandFooter, esc } from './views';

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
  /**
   * Hoeveel berichten aan het eind nieuw zijn sinds de vorige render. Alleen
   * die animeren; de rest staat stil. Zonder dit speelt bij elke herrender het
   * hele gesprek opnieuw af, want `render()` bouwt de container elke keer
   * volledig opnieuw op.
   */
  fresh: number;
}

function message(m: ThreadMessage, fresh: boolean): string {
  const cls = fresh ? ' ltb-new' : '';
  if (m.from === 'user') return `<div class="ltb-user${cls}">${esc(m.text)}</div>`;
  const button = m.button
    ? `<a class="ltb-cardbtn" href="${esc(m.button.url)}" data-action="card-link">${esc(m.button.label)}${icons.chevronRight(16)}</a>`
    : '';
  return `<div class="ltb-bot${cls}">${renderText(m.text)}${button}</div>`;
}

export function threadView(cfg: LeadBotConfig, s: ThreadState, opts: { back: boolean }): string {
  const t = cfg.texts;
  const first = s.messages.length - Math.max(0, s.fresh);
  const body = s.messages.map((m, i) => message(m, i >= first)).join('');
  const typing = s.typing
    ? '<div class="ltb-typing"><span></span><span></span><span></span></div>'
    : '';
  const chips = s.typing
    ? ''
    : `<div class="ltb-opts${s.fresh > 0 ? ' ltb-new' : ''}">${s.chips
        .map(
          (c) =>
            `<button type="button" class="ltb-opt${c.style ? ' ltb-opt--' + c.style : ''}" data-action="chip-${esc(c.id)}">${esc(c.label)}</button>`,
        )
        .join('')}</div>`;
  const back = opts.back
    ? `<button class="ltb-back ltb-thread-back" data-action="back" aria-label="${esc(t.back)}">${icons.back(18)}</button>`
    : '';
  // Dezelfde kop als het kanaalpaneel: een gesprek is geen WhatsApp-venster.
  return `
  <div class="ltb-handle"><span></span></div>
  <div class="ltb-head">
    ${back}
    <button class="ltb-close" data-action="close" aria-label="${esc(t.close)}">${icons.close(15)}</button>
    <div class="ltb-header">
      <div class="ltb-avatar">${avatar(cfg, 'ltb-avatar-fallback')}<span class="ltb-avatar-dot"></span></div>
      <div>
        <p class="ltb-header-name">${agentLine(cfg)}</p>
        <p class="ltb-header-status">${esc(t.responseTime)}</p>
      </div>
    </div>
  </div>
  <div class="ltb-thread" role="log" aria-live="polite">
    ${body}${typing}${chips}
  </div>
  ${brandFooter(cfg)}`;
}
