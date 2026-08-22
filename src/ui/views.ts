import type { DynamicNumber } from '../calltracking';
import type { LeadBotConfig } from '../config';
import type { Country } from '../countries';
import { icons } from './icons';

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  );
}

function avatar(cfg: LeadBotConfig, cls: string): string {
  if (cfg.agentPhoto) return `<img src="${esc(cfg.agentPhoto)}" alt="">`;
  const initial = esc((cfg.agentName || cfg.companyName || 'L').charAt(0).toUpperCase());
  return `<div class="${cls}">${initial}</div>`;
}

function agentLine(cfg: LeadBotConfig): string {
  const company = cfg.companyName
    ? ` <span>${esc(cfg.texts.from)} ${esc(cfg.companyName)}</span>`
    : '';
  return `${esc(cfg.agentName || cfg.companyName)}${company}`;
}

/**
 * De promotielink is de enige plek waar de LeadBot naar buiten wijst. De UTM's
 * maken in Analytics zichtbaar hoeveel bezoek hij oplevert, en per klantsite
 * hoeveel: de campagne is de host waar de LeadBot draait.
 */
export function brandUrl(host: string): string {
  const site = host.replace(/^www\./, '');
  const params = new URLSearchParams({
    utm_source: 'leadbot',
    utm_medium: 'referral',
    utm_campaign: site || '(not set)',
  });
  return `https://leadtrackr.io/?${params}`;
}

export function brandFooter(cfg: LeadBotConfig): string {
  if (!cfg.branding) return '';
  const href = esc(brandUrl(location.hostname));
  return `<div class="ltb-brand"><span>Better leads start with&nbsp;</span><a href="${href}" target="_blank" rel="noopener">LeadTrackr.io</a><span>&nbsp;🚀</span></div>`;
}

export function launcherView(cfg: LeadBotConfig, showTeaser: boolean): string {
  const teaser = showTeaser
    ? `<div class="ltb-teaser">
         <p class="ltb-teaser-name">${agentLine(cfg)}</p>
         <p class="ltb-teaser-text">${esc(cfg.greeting)}</p>
         <button class="ltb-teaser-close" data-action="teaser-close" aria-label="${esc(cfg.texts.close)}">${icons.close(14)}</button>
       </div>`
    : '';
  return `${teaser}
    <button class="ltb-launcher" data-action="open" aria-label="${esc(cfg.texts.launcherLabel)}" aria-expanded="false">
      ${avatar(cfg, 'ltb-launcher-fallback')}
      <span class="ltb-launcher-badge">${icons.chat(11)}</span>
    </button>`;
}

function channelButton(action: string, icon: string, title: string, sub: string, href?: string): string {
  const tag = href ? 'a' : 'button';
  const hrefAttr = href ? ` href="${esc(href)}"` : ' type="button"';
  return `<${tag} class="ltb-channel" data-action="${action}"${hrefAttr}>
    <span class="ltb-channel-icon">${icon}</span>
    <span class="ltb-channel-body">
      <span class="ltb-channel-title">${esc(title)}</span>
      <span class="ltb-channel-sub">${esc(sub)}</span>
    </span>
    <span class="ltb-channel-chevron">${icons.chevronRight(18)}</span>
  </${tag}>`;
}

export function panelView(cfg: LeadBotConfig, dynamicNumber: DynamicNumber | null): string {
  const t = cfg.texts;
  const buttons = cfg.channels
    .map((c) => {
      if (c === 'contact_form') return channelButton('channel-contact_form', icons.chat(20), t.msgTitle, t.msgSub);
      if (c === 'phone') {
        const display = dynamicNumber?.display || cfg.phone;
        if (!display) return '';
        const href = dynamicNumber
          ? 'tel:+' + dynamicNumber.link.replace(/\D/g, '')
          : 'tel:' + (cfg.phone || '').replace(/[\s-]/g, '');
        return channelButton('channel-phone', icons.phone(20), t.callTitle, display, href);
      }
      return channelButton('channel-whatsapp', icons.whatsapp(20), t.waTitle, t.waSub);
    })
    .join('');
  return `
  <div class="ltb-handle"><span></span></div>
  <div class="ltb-head">
    <button class="ltb-close" data-action="close" aria-label="${esc(t.close)}">${icons.close(15)}</button>
    <div class="ltb-header">
      <div class="ltb-avatar">${avatar(cfg, 'ltb-avatar-fallback')}<span class="ltb-avatar-dot"></span></div>
      <div>
        <p class="ltb-header-name">${agentLine(cfg)}</p>
        <p class="ltb-header-status">${esc(t.responseTime)}</p>
      </div>
    </div>
    <div class="ltb-greeting">${esc(cfg.greeting)}</div>
  </div>
  <div class="ltb-channels">${buttons}</div>
  ${brandFooter(cfg)}`;
}

export interface FormState {
  values: { name: string; email: string; message: string };
  errors: Record<string, string>;
  sending: boolean;
  sendFailed: boolean;
}

function field(id: string, label: string, control: string, error: string | undefined): string {
  return `<div class="ltb-field${error ? ' ltb-invalid' : ''}">
    <label for="${id}">${esc(label)}</label>
    ${control}
    ${error ? `<p class="ltb-error" role="alert">${icons.errorInfo(13)} ${esc(error)}</p>` : ''}
  </div>`;
}

export function messageView(cfg: LeadBotConfig, s: FormState): string {
  const t = cfg.texts;
  return `
  <div class="ltb-handle"><span></span></div>
  <div class="ltb-viewhead">
    <button class="ltb-back" data-action="back" aria-label="${esc(t.back)}">${icons.back(18)}</button>
    ${avatar(cfg, 'ltb-avatar-fallback')}
    <p class="ltb-viewhead-title">${esc(t.formTitle)}</p>
  </div>
  <form class="ltb-form" data-form="contact_form" novalidate>
    ${s.sendFailed ? `<div class="ltb-sendfail" role="alert">${esc(t.errorSend)}</div>` : ''}
    ${field('ltb-name', t.nameLabel, `<input class="ltb-input" id="ltb-name" name="name" type="text" placeholder="${esc(t.namePlaceholder)}" value="${esc(s.values.name)}">`, s.errors.name)}
    ${field('ltb-email', t.emailLabel, `<input class="ltb-input" id="ltb-email" name="email" type="email" placeholder="${esc(t.emailPlaceholder)}" value="${esc(s.values.email)}">`, s.errors.email)}
    ${field('ltb-message', t.messageLabel, `<textarea class="ltb-textarea" id="ltb-message" name="message" rows="3" placeholder="${esc(t.messagePlaceholder)}">${esc(s.values.message)}</textarea>`, s.errors.message)}
    <div class="ltb-hp" aria-hidden="true"><input name="ltb_website" type="text" tabindex="-1" autocomplete="off"></div>
    <button class="ltb-submit" type="submit"${s.sending ? ' disabled' : ''}>${esc(s.sending ? '…' : t.submit)}</button>
  </form>
  ${brandFooter(cfg)}`;
}

export interface WaState {
  step: 'compose' | 'phone';
  /** False during the first render after sending — plays the message
      sequence; true afterwards so re-renders don't replay it. */
  entered: boolean;
  message: string;
  phone: string;
  country: Country;
  error: string | null;
  sending: boolean;
}

// Gedeelde WhatsApp-bouwstenen: dezelfde bubbels, ticks en inputbar voeden
// zowel de kanaal-flow in het panel als de interceptor-modal.
interface WaChatOpts {
  greeting: string;
  message: string;
  showSent: boolean;
  question: string;
  phoneSent?: string;
  isStatic: boolean;
}

function waChat(o: WaChatOpts): string {
  // Zonder question (nummervraag uit) blijft alleen de verzonden bubbel staan:
  // de bot vraagt dan niets meer en de bezoeker gaat direct door naar WhatsApp.
  const reply = o.question
    ? `<div class="ltb-wa-reply">
           <div class="ltb-wa-bubble ltb-wa-typing" aria-hidden="true"><span></span><span></span><span></span></div>
           <div class="ltb-wa-bubble ltb-wa-question">${esc(o.question)}</div>
         </div>`
    : '';
  const sent = o.showSent
    ? `<div class="ltb-wa-bubble ltb-wa-sent">${esc(o.message)}<p class="ltb-wa-meta"><span class="ltb-wa-ticks"><span class="ltb-wa-tick-one">${icons.check(12, 2.2)}</span><span class="ltb-wa-tick-two">${icons.doubleCheck(14)}</span></span></p></div>
         ${reply}`
    : '';
  const phoneSent = o.phoneSent
    ? `<div class="ltb-wa-bubble ltb-wa-sent">${esc(o.phoneSent)}<p class="ltb-wa-meta"><span class="ltb-wa-ticks"><span class="ltb-wa-tick-two">${icons.doubleCheck(14)}</span></span></p></div>`
    : '';
  return `<div class="ltb-wa-chat${o.isStatic ? ' ltb-static' : ''}">
    <div class="ltb-wa-bubble">${esc(o.greeting)}</div>
    ${sent}${phoneSent}
  </div>`;
}

interface WaInputState {
  step: 'compose' | 'phone';
  message: string;
  phone: string;
  country: Country;
  error: string | null;
  sending: boolean;
}

// Meerregelig berichtveld dat meegroeit met de inhoud (à la WhatsApp),
// tot een maximum — daarna scrollt het veld zelf.
export function autoGrowMessage(el: HTMLTextAreaElement): void {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function waInputBar(cfg: LeadBotConfig, s: WaInputState, countries: Country[]): string {
  const t = cfg.texts;
  if (s.step === 'compose') {
    return `<div class="ltb-wa-inputbar">
          <textarea class="ltb-wa-input ltb-wa-multiline" data-wa="message" rows="1" aria-label="${esc(t.waPlaceholder)}" placeholder="${esc(t.waPlaceholder)}">${esc(s.message)}</textarea>
          <button type="button" class="ltb-wa-send" data-action="wa-send" aria-label="${esc(t.waTitle)}">${icons.send(19)}</button>
        </div>`;
  }
  // Native <select> under an invisible overlay: system picker UX (searchable on
  // Apple/Android), no custom dropdown. Chosen flag is shown in the chip.
  const options = countries
    .map(
      (c) =>
        `<option value="${c.code}"${c.code === s.country.code ? ' selected' : ''}>${esc(c.name)} (${c.dial})</option>`,
    )
    .join('');
  return `<div class="ltb-wa-inputbar">
          <div class="ltb-wa-phonewrap">
            <span class="ltb-wa-cc">
              <span class="ltb-wa-cc-label">${s.country.flag}&nbsp;${s.country.dial}</span>
              ${icons.chevronDown(12)}
              <select class="ltb-wa-cc-select" data-wa="country" aria-label="${esc(t.waCountryLabel)}">${options}</select>
            </span>
            <span class="ltb-wa-cc-divider"></span>
            <input class="ltb-wa-phone" data-wa="phone" type="tel" enterkeyhint="send" autocomplete="tel-national" aria-label="${esc(t.waPhonePlaceholder)}" placeholder="${esc(t.waPhonePlaceholder)}" value="${esc(s.phone)}">
          </div>
          <button type="button" class="ltb-wa-send" data-action="wa-phone-send" aria-label="${esc(t.waTitle)}"${s.sending ? ' disabled' : ''}>${icons.send(19)}</button>
        </div>
        ${s.error ? `<div class="ltb-wa-error"><p class="ltb-error" role="alert">${icons.errorInfo(13)} ${esc(s.error)}</p></div>` : ''}`;
}

export function whatsappView(cfg: LeadBotConfig, s: WaState, countries: Country[]): string {
  const t = cfg.texts;
  return `
  <div class="ltb-handle"><span></span></div>
  <div class="ltb-wa-head">
    <button class="ltb-back" data-action="back" aria-label="${esc(t.back)}">${icons.back(18)}</button>
    ${avatar(cfg, 'ltb-avatar-fallback')}
    <div>
      <p class="ltb-wa-head-name">${esc(cfg.agentName || cfg.companyName)}</p>
      <p class="ltb-wa-head-status">${esc(t.responseTime)}</p>
    </div>
    <span class="ltb-wa-head-icon">${icons.whatsapp(22)}</span>
  </div>
  ${waChat({ greeting: cfg.greeting, message: s.message, showSent: s.step === 'phone', question: cfg.whatsappPhoneQuestion ? t.waPhoneQuestion : '', isStatic: s.entered })}
  ${waInputBar(cfg, s, countries)}`;
}

export interface WiState {
  view: 'compose' | 'phone' | 'opening' | 'success';
  entered: boolean;
  message: string;
  phone: string;
  /** Genormaliseerd E.164-nummer na een geslaagde submit. */
  phoneE164: string | null;
  country: Country;
  error: string | null;
  sending: boolean;
  /** Doelnummer (alleen cijfers) uit de onderschepte link of de config-fallback. */
  number: string;
}

export function interceptorView(cfg: LeadBotConfig, s: WiState, countries: Country[]): string {
  const t = cfg.texts;
  const done = s.view === 'opening' || s.view === 'success';
  // Zelfde teksten als de WhatsApp-flow in het panel — de interceptor is
  // dezelfde chat, alleen anders geopend.
  const chat = waChat({
    greeting: cfg.greeting,
    message: s.message,
    showSent: s.view !== 'compose',
    question: cfg.whatsappPhoneQuestion ? t.waPhoneQuestion : '',
    phoneSent: done && s.phoneE164 ? s.phoneE164 : undefined,
    isStatic: s.entered,
  });
  const waHref =
    'https://wa.me/' + s.number + (s.message ? '?text=' + encodeURIComponent(s.message) : '');
  const footer = done
    ? `<div class="ltb-wi-handoff">
        ${
          s.view === 'opening'
            ? `<div class="ltb-wi-spinner" aria-hidden="true"></div>
               <p class="ltb-wi-handoff-title">${esc(t.waiOpening)}</p>`
            : `<div class="ltb-wi-badge">${icons.whatsapp(28)}</div>
               <p class="ltb-wi-handoff-title">${esc(t.waSuccessTitle)}</p>
               <p class="ltb-wi-handoff-body">${esc(t.waSuccessBody)}</p>
               <a class="ltb-wi-reopen" href="${esc(waHref)}" target="_blank" rel="noopener">${esc(t.waiReopen)}</a>`
        }
      </div>
      ${brandFooter(cfg)}`
    : waInputBar(cfg, { step: s.view === 'phone' ? 'phone' : 'compose', message: s.message, phone: s.phone, country: s.country, error: s.error, sending: s.sending }, countries);
  return `
  <div class="ltb-wi-overlay" data-action="close"></div>
  <div class="ltb-wi-modal" role="dialog" aria-modal="true" aria-label="${esc(t.waiDialogLabel)}">
    <div class="ltb-wa-head">
      ${avatar(cfg, 'ltb-avatar-fallback')}
      <div>
        <p class="ltb-wa-head-name">${esc(cfg.agentName || cfg.companyName)}</p>
        <p class="ltb-wa-head-status">${esc(t.responseTime)}</p>
      </div>
      <span class="ltb-wa-head-icon">${icons.whatsapp(22)}</span>
      <button class="ltb-wi-close" data-action="close" aria-label="${esc(t.close)}">${icons.close(16)}</button>
    </div>
    ${chat}
    ${footer}
  </div>`;
}

export function successView(cfg: LeadBotConfig, channel: 'contact_form' | 'whatsapp'): string {
  const t = cfg.texts;
  const title = channel === 'whatsapp' ? t.waSuccessTitle : t.successTitle;
  const body = channel === 'whatsapp' ? t.waSuccessBody : t.successBody;
  return `
  <div class="ltb-handle"><span></span></div>
  <div style="position:relative">
    <button class="ltb-close" data-action="close" aria-label="${esc(t.close)}">${icons.close(15)}</button>
    <div class="ltb-success">
      <div class="ltb-success-avatar">
        ${avatar(cfg, 'ltb-avatar-fallback')}
        <span class="ltb-success-badge">${channel === 'whatsapp' ? icons.whatsapp(14) : icons.check(13)}</span>
      </div>
      <p class="ltb-success-title">${esc(title)}</p>
      <p class="ltb-success-body">${esc(body)}</p>
      <button class="ltb-success-back" data-action="back">${icons.back(15)} ${esc(t.successBack)}</button>
    </div>
  </div>
  ${brandFooter(cfg)}`;
}
