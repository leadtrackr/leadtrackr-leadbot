import type { WidgetConfig } from '../config';
import type { Country } from '../validate';
import { COUNTRIES } from '../validate';
import { icons } from './icons';

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function avatar(cfg: WidgetConfig, cls: string): string {
  if (cfg.agentPhoto) return `<img src="${esc(cfg.agentPhoto)}" alt="">`;
  const initial = esc((cfg.agentName || cfg.companyName || 'L').charAt(0).toUpperCase());
  return `<div class="${cls}">${initial}</div>`;
}

function agentLine(cfg: WidgetConfig): string {
  const company = cfg.companyName
    ? ` <span>${esc(cfg.texts.from)} ${esc(cfg.companyName)}</span>`
    : '';
  return `${esc(cfg.agentName || cfg.companyName)}${company}`;
}

export function brandFooter(): string {
  return `<div class="ltw-brand"><span>Better leads start with&nbsp;</span><a href="https://leadtrackr.io" target="_blank" rel="noopener">LeadTrackr.io</a><span>&nbsp;🚀</span></div>`;
}

export function launcherView(cfg: WidgetConfig, showTeaser: boolean): string {
  const teaser = showTeaser
    ? `<div class="ltw-teaser">
         <p class="ltw-teaser-name">${agentLine(cfg)}</p>
         <p class="ltw-teaser-text">${esc(cfg.greeting)}</p>
         <button class="ltw-teaser-close" data-action="teaser-close" aria-label="${esc(cfg.texts.close)}">${icons.close(14)}</button>
       </div>`
    : '';
  return `${teaser}
    <button class="ltw-launcher" data-action="open" aria-label="${esc(cfg.texts.launcherLabel)}" aria-expanded="false">
      ${avatar(cfg, 'ltw-launcher-fallback')}
      <span class="ltw-launcher-badge">${icons.chat(11)}</span>
    </button>`;
}

function channelButton(action: string, icon: string, title: string, sub: string, href?: string): string {
  const tag = href ? 'a' : 'button';
  const hrefAttr = href ? ` href="${esc(href)}"` : ' type="button"';
  return `<${tag} class="ltw-channel" data-action="${action}"${hrefAttr}>
    <span class="ltw-channel-icon">${icon}</span>
    <span class="ltw-channel-body">
      <span class="ltw-channel-title">${esc(title)}</span>
      <span class="ltw-channel-sub">${esc(sub)}</span>
    </span>
    <span class="ltw-channel-chevron">${icons.chevronRight(18)}</span>
  </${tag}>`;
}

export function panelView(cfg: WidgetConfig): string {
  const t = cfg.texts;
  const buttons = cfg.channels
    .map((c) => {
      if (c === 'message') return channelButton('channel-message', icons.chat(20), t.msgTitle, t.msgSub);
      if (c === 'call')
        return channelButton('channel-call', icons.phone(20), t.callTitle, cfg.phone || '', 'tel:' + (cfg.phone || '').replace(/[\s-]/g, ''));
      return channelButton('channel-whatsapp', icons.whatsapp(20), t.waTitle, t.waSub);
    })
    .join('');
  return `
  <div class="ltw-handle"><span></span></div>
  <div class="ltw-head">
    <button class="ltw-close" data-action="close" aria-label="${esc(t.close)}">${icons.close(15)}</button>
    <div class="ltw-header">
      <div class="ltw-avatar">${avatar(cfg, 'ltw-avatar-fallback')}<span class="ltw-avatar-dot"></span></div>
      <div>
        <p class="ltw-header-name">${agentLine(cfg)}</p>
        <p class="ltw-header-status">${esc(t.online)}</p>
      </div>
    </div>
    <div class="ltw-greeting">${esc(cfg.greeting)}</div>
  </div>
  <div class="ltw-channels">${buttons}</div>
  ${brandFooter()}`;
}

export interface FormState {
  values: { name: string; email: string; message: string };
  errors: Record<string, string>;
  sending: boolean;
  sendFailed: boolean;
}

function field(id: string, label: string, control: string, error: string | undefined): string {
  return `<div class="ltw-field${error ? ' ltw-invalid' : ''}">
    <label for="${id}">${esc(label)}</label>
    ${control}
    ${error ? `<p class="ltw-error" role="alert">${icons.errorInfo(13)} ${esc(error)}</p>` : ''}
  </div>`;
}

export function messageView(cfg: WidgetConfig, s: FormState): string {
  const t = cfg.texts;
  return `
  <div class="ltw-handle"><span></span></div>
  <div class="ltw-viewhead">
    <button class="ltw-back" data-action="back" aria-label="${esc(t.back)}">${icons.back(18)}</button>
    ${avatar(cfg, 'ltw-avatar-fallback')}
    <p class="ltw-viewhead-title">${esc(t.formTitle)}</p>
  </div>
  <form class="ltw-form" data-form="message" novalidate>
    ${s.sendFailed ? `<div class="ltw-sendfail" role="alert">${esc(t.errorSend)}</div>` : ''}
    ${field('ltw-name', t.nameLabel, `<input class="ltw-input" id="ltw-name" name="name" type="text" placeholder="${esc(t.namePlaceholder)}" value="${esc(s.values.name)}">`, s.errors.name)}
    ${field('ltw-email', t.emailLabel, `<input class="ltw-input" id="ltw-email" name="email" type="email" placeholder="${esc(t.emailPlaceholder)}" value="${esc(s.values.email)}">`, s.errors.email)}
    ${field('ltw-message', t.messageLabel, `<textarea class="ltw-textarea" id="ltw-message" name="message" rows="3" placeholder="${esc(t.messagePlaceholder)}">${esc(s.values.message)}</textarea>`, s.errors.message)}
    <div class="ltw-hp" aria-hidden="true"><input name="ltw_website" type="text" tabindex="-1" autocomplete="off"></div>
    <button class="ltw-submit" type="submit"${s.sending ? ' disabled' : ''}>${esc(s.sending ? '…' : t.submit)}</button>
  </form>
  ${brandFooter()}`;
}

export interface WaState {
  step: 'compose' | 'phone';
  message: string;
  phone: string;
  country: Country;
  pickerOpen: boolean;
  search: string;
  error: string | null;
  sending: boolean;
}

export function whatsappView(cfg: WidgetConfig, s: WaState): string {
  const t = cfg.texts;
  const sent =
    s.step === 'phone'
      ? `<div class="ltw-wa-bubble ltw-wa-sent">${esc(s.message)}<p class="ltw-wa-meta">${icons.doubleCheck(14)}</p></div>
         <div class="ltw-wa-bubble">${esc(t.waPhoneQuestion)}</div>`
      : '';
  const countries = COUNTRIES.map(
    (c) => `<button type="button" class="ltw-wa-country${c.code === s.country.code ? ' ltw-selected' : ''}" data-action="wa-country" data-country="${c.code}">
        ${c.flag} <span class="ltw-wa-country-name">${esc(c.name)}</span> <span class="ltw-wa-country-dial">${c.dial}</span>
        ${c.code === s.country.code ? `<span style="color:#25D366;display:flex">${icons.check(13, 2.4)}</span>` : ''}
      </button>`,
  ).join('');
  const inputBar =
    s.step === 'compose'
      ? `<div class="ltw-wa-inputbar">
          <input class="ltw-wa-input" data-wa="message" aria-label="${esc(t.waPlaceholder)}" placeholder="${esc(t.waPlaceholder)}" value="${esc(s.message)}">
          <button type="button" class="ltw-wa-send" data-action="wa-send" aria-label="${esc(t.waTitle)}">${icons.send(19)}</button>
        </div>`
      : `${s.pickerOpen
          ? `<div class="ltw-wa-picker">
              <input class="ltw-wa-search" data-wa="search" placeholder="${esc(t.waSearchPlaceholder)}" value="${esc(s.search)}">
              <div class="ltw-wa-list">${countries}</div>
            </div>`
          : ''}
        <div class="ltw-wa-inputbar">
          <div class="ltw-wa-phonewrap">
            <button type="button" class="ltw-wa-cc" data-action="wa-cc-toggle" aria-label="Landcode">${s.country.flag} ${s.country.dial} ${icons.chevronDown(12)}</button>
            <span class="ltw-wa-cc-divider"></span>
            <input class="ltw-wa-phone" data-wa="phone" type="tel" aria-label="${esc(t.waPhonePlaceholder)}" placeholder="${esc(t.waPhonePlaceholder)}" value="${esc(s.phone)}">
          </div>
          <button type="button" class="ltw-wa-send" data-action="wa-phone-send" aria-label="${esc(t.waTitle)}"${s.sending ? ' disabled' : ''}>${icons.send(19)}</button>
        </div>
        ${s.error ? `<div class="ltw-wa-error"><p class="ltw-error" role="alert">${icons.errorInfo(13)} ${esc(s.error)}</p></div>` : ''}`;
  return `
  <div class="ltw-handle"><span></span></div>
  <div class="ltw-wa-head">
    <button class="ltw-back" data-action="back" aria-label="${esc(t.back)}">${icons.back(18)}</button>
    ${avatar(cfg, 'ltw-avatar-fallback')}
    <div>
      <p class="ltw-wa-head-name">${esc(cfg.agentName || cfg.companyName)}</p>
      <p class="ltw-wa-head-status">${esc(t.online)}</p>
    </div>
    <span class="ltw-wa-head-icon">${icons.whatsapp(22)}</span>
  </div>
  <div class="ltw-wa-chat">
    <div class="ltw-wa-bubble">${esc(cfg.greeting)}</div>
    ${sent}
  </div>
  ${inputBar}`;
}

export function successView(cfg: WidgetConfig): string {
  const t = cfg.texts;
  return `
  <div class="ltw-handle"><span></span></div>
  <div style="position:relative">
    <button class="ltw-close" data-action="close" aria-label="${esc(t.close)}">${icons.close(15)}</button>
    <div class="ltw-success">
      <div class="ltw-success-avatar">
        ${avatar(cfg, 'ltw-avatar-fallback')}
        <span class="ltw-success-badge">${icons.check(13)}</span>
      </div>
      <p class="ltw-success-title">${esc(t.successTitle)}</p>
      <p class="ltw-success-body">${esc(t.successBody)}</p>
      <button class="ltw-success-back" data-action="back">${icons.back(15)} ${esc(t.successBack)}</button>
    </div>
  </div>
  ${brandFooter()}`;
}
