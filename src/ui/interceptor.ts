import type { LeadBotConfig } from '../config';
import { getCountries } from '../countries';
import { pushChannelClick, pushConversion } from '../datalayer';
import { parseWaLink } from '../interceptor';
import { buildLeadPayload } from '../payload';
import { sendLead } from '../transport';
import { normalizePhone } from '../validate';
import { buildStyles } from './styles';
import { trackVisualViewport } from './viewport';
import type { WiState } from './views';
import { autoGrowMessage, interceptorView } from './views';

const MIN_OPEN_MS = 2000;
const OPENING_MS = 900;

export function mountWhatsAppInterceptor(cfg: LeadBotConfig): void {
  if (document.getElementById('lt-leadbot-wi-host')) return;

  const host = document.createElement('div');
  host.id = 'lt-leadbot-wi-host';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = buildStyles(cfg);
  // Zelfde id als de LeadBot-container (eigen shadow root): zo gelden de
  // CSS-variabelen uit buildStyles ook hier.
  const container = document.createElement('div');
  container.id = 'ltb-container';
  shadow.append(style, container);
  document.body.appendChild(host);
  trackVisualViewport(container);

  const countries = getCountries(cfg.language);
  let isOpen = false;
  // Entree-animatie van overlay + modal alleen bij het openen; re-renders
  // (stapwissel, foutmelding) tonen de schil direct.
  let shellEntered = false;
  let openedAt = 0;
  let lastFocus: HTMLElement | null = null;

  const s: WiState = {
    view: 'compose',
    entered: false,
    message: '',
    phone: '',
    phoneE164: null,
    country: countries.find((c) => c.code === cfg.defaultCountry) || countries[0],
    error: null,
    sending: false,
    number: '',
  };

  function render(): void {
    container.innerHTML = isOpen
      ? `<div class="ltb-wi-root${shellEntered ? ' ltb-wi-static' : ''}">${interceptorView(cfg, s, countries)}</div>`
      : '';
    shellEntered = isOpen;
    const msg = container.querySelector<HTMLTextAreaElement>('textarea[data-wa="message"]');
    if (msg) autoGrowMessage(msg);
    // Nieuwste bubbel (bijv. de nummer-vraag) altijd in beeld
    const chat = container.querySelector<HTMLElement>('.ltb-wa-chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
  }

  function openModal(number: string, text: string): void {
    isOpen = true;
    shellEntered = false;
    s.view = 'compose';
    s.entered = false;
    s.message = text;
    s.phone = '';
    s.phoneE164 = null;
    s.error = null;
    s.sending = false;
    s.number = number;
    openedAt = Date.now();
    lastFocus = document.activeElement as HTMLElement | null;
    // De LeadBot-launcher schemert anders door de overlay heen.
    document.getElementById('lt-leadbot-host')?.style.setProperty('display', 'none');
    pushChannelClick('whatsapp');
    render();
    container.querySelector<HTMLInputElement>('[data-wa="message"]')?.focus();
  }

  function close(): void {
    isOpen = false;
    document.getElementById('lt-leadbot-host')?.style.removeProperty('display');
    render();
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  }

  function readInputs(): void {
    const msg = container.querySelector<HTMLInputElement>('[data-wa="message"]');
    if (msg) s.message = msg.value.trim();
    const phone = container.querySelector<HTMLInputElement>('[data-wa="phone"]');
    if (phone) s.phone = phone.value.trim();
  }

  function openWhatsApp(): void {
    window.open(
      'https://wa.me/' + s.number + '?text=' + encodeURIComponent(s.message),
      '_blank',
      'noopener',
    );
  }

  function finish(): void {
    s.view = 'opening';
    s.entered = true;
    render();
    openWhatsApp();
    setTimeout(() => {
      if (isOpen && s.view === 'opening') {
        s.view = 'success';
        render();
      }
    }, OPENING_MS);
  }

  async function submit(): Promise<void> {
    readInputs();
    const normalized = normalizePhone(s.phone, s.country.dial);
    if (!normalized) {
      s.error = cfg.texts.errorPhone;
      render();
      return;
    }
    s.error = null;
    s.phoneE164 = normalized;
    // Bot-check: binnen 2s na openen geen POST/conversie, maar de bezoeker
    // klikte op een echte WhatsApp-link — de handoff gaat dus wél door.
    if (Date.now() - openedAt < MIN_OPEN_MS) {
      finish();
      return;
    }
    s.sending = true;
    render();
    const res = await sendLead(
      buildLeadPayload(cfg, 'whatsapp', { phone: normalized, message: s.message }, 'whatsapp_interceptor'),
      cfg.endpoint,
    );
    s.sending = false;
    // 404 = project niet gevonden, 403 = abonnement inactief: bewust blokkeren
    // (betaal-check). Elke andere fout (netwerk, 5xx, overige 4xx) mag de
    // bezoeker nooit in de weg zitten: handoff én conversie gaan gewoon door.
    if (res.status === 404 || res.status === 403) {
      s.error = cfg.texts.errorSend;
      render();
      return;
    }
    pushConversion('whatsapp', { phone: normalized });
    finish();
  }

  // Capture-fase zodat we vóór eventuele site-handlers zitten. Kliks binnen
  // onze shadow root retargeten naar de host en matchen dus nooit een <a>.
  document.addEventListener(
    'click',
    (e) => {
      if (!host.isConnected || e.defaultPrevented || isOpen) return;
      const anchor = (e.target as Element | null)?.closest?.('a[href]');
      if (!anchor) return;
      const target = parseWaLink(anchor.getAttribute('href') || '');
      if (!target) return;
      const number = target.phone || (cfg.whatsapp || '').replace(/\D/g, '');
      if (!number) return;
      e.preventDefault();
      e.stopPropagation();
      openModal(number, target.text);
    },
    true,
  );

  container.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target) return;
    switch (target.getAttribute('data-action')) {
      case 'close':
        close();
        break;
      case 'wa-send':
        readInputs();
        if (s.message) {
          s.view = 'phone';
          s.entered = false;
          render();
          s.entered = true; // volgende renders spelen de sequence niet opnieuw
          container.querySelector<HTMLInputElement>('[data-wa="phone"]')?.focus();
        }
        break;
      case 'wa-phone-send':
        void submit();
        break;
    }
  });

  container.addEventListener('change', (e) => {
    const el = e.target as HTMLSelectElement;
    if (el.getAttribute('data-wa') === 'country') {
      readInputs();
      const country = countries.find((c) => c.code === el.value);
      if (country) s.country = country;
      render();
      container.querySelector<HTMLInputElement>('[data-wa="phone"]')?.focus();
    }
  });

  container.addEventListener('input', (e) => {
    const el = e.target as HTMLElement;
    if (el.tagName === 'TEXTAREA' && el.getAttribute('data-wa') === 'message') {
      autoGrowMessage(el as HTMLTextAreaElement);
    }
  });

  // WhatsApp-gedrag: desktop verstuurt met Enter (Shift+Enter = nieuwe regel),
  // op touch-toetsenborden is return altijd een nieuwe regel.
  const coarsePointer = matchMedia('(pointer: coarse)').matches;

  container.addEventListener('keydown', (e) => {
    const el = e.target as HTMLElement;
    if (e.key === 'Escape' && isOpen) {
      close();
      return;
    }
    if (e.key === 'Enter' && el.getAttribute('data-wa') === 'message') {
      if (e.shiftKey || coarsePointer) return;
      e.preventDefault();
      container.querySelector<HTMLElement>('[data-action="wa-send"]')?.click();
      return;
    }
    if (e.key === 'Enter' && el.getAttribute('data-wa') === 'phone') {
      e.preventDefault();
      container.querySelector<HTMLElement>('[data-action="wa-phone-send"]')?.click();
      return;
    }
    if (e.key === 'Tab' && isOpen) {
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(
          '.ltb-wi-modal button, .ltb-wi-modal a[href], .ltb-wi-modal input, .ltb-wi-modal select',
        ),
      ).filter((f) => f.tabIndex !== -1);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = shadow.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}
