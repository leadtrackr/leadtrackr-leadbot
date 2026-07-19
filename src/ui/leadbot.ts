import { getDynamicNumber } from '../calltracking';
import type { LeadBotConfig } from '../config';
import { getCountries } from '../countries';
import { pushChannelClick, pushConversion, pushOpen } from '../datalayer';
import { buildLeadPayload } from '../payload';
import { sendLead } from '../transport';
import { isValidEmail, normalizePhone } from '../validate';
import { buildStyles } from './styles';
import type { FormState, WaState } from './views';
import { launcherView, messageView, panelView, successView, whatsappView } from './views';

type View = 'closed' | 'panel' | 'contact_form' | 'whatsapp' | 'success';

const TEASER_KEY = 'ltb_teaser_dismissed';
const MIN_OPEN_MS = 2000;

export function mountLeadBot(cfg: LeadBotConfig): void {
  if (document.getElementById('lt-leadbot-host')) return;

  const host = document.createElement('div');
  host.id = 'lt-leadbot-host';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = buildStyles(cfg);
  const container = document.createElement('div');
  container.id = 'ltb-container';
  shadow.append(style, container);
  document.body.appendChild(host);

  const countries = getCountries(cfg.language);

  let view: View = 'closed';
  let successChannel: 'contact_form' | 'whatsapp' = 'contact_form';
  let openedAt = 0;

  const form: FormState = {
    values: { name: '', email: '', message: '' },
    errors: {},
    sending: false,
    sendFailed: false,
  };
  const wa: WaState = {
    step: 'compose',
    message: '',
    phone: '',
    country: countries.find((c) => c.code === cfg.defaultCountry) || countries[0],
    error: null,
    sending: false,
  };

  function teaserVisible(): boolean {
    try {
      return cfg.teaser && sessionStorage.getItem(TEASER_KEY) !== '1';
    } catch {
      return cfg.teaser;
    }
  }

  function render(): void {
    const sideClass = cfg.position === 'left' ? ' ltb-left' : '';
    if (view === 'closed') {
      container.innerHTML = `<div class="ltb-root${sideClass}">${launcherView(cfg, teaserVisible())}</div>`;
      return;
    }
    const dynamicNumber = cfg.callTracking
      ? getDynamicNumber(cfg.callTracking.prefix, cfg.callTracking.swapGroup)
      : null;
    const inner =
      view === 'panel'
        ? panelView(cfg, dynamicNumber)
        : view === 'contact_form'
          ? messageView(cfg, form)
          : view === 'whatsapp'
            ? whatsappView(cfg, wa, countries)
            : successView(cfg, successChannel);
    container.innerHTML = `<div class="ltb-root${sideClass}"><div class="ltb-overlay" data-action="close"></div><div class="ltb-panel" role="dialog" aria-modal="true"><div class="ltb-view">${inner}</div></div></div>`;
    container.querySelector<HTMLElement>('.ltb-panel .ltb-close, .ltb-panel .ltb-back')?.focus();
  }

  function open(): void {
    view = 'panel';
    openedAt = Date.now();
    pushOpen();
    render();
  }

  function close(): void {
    view = 'closed';
    render();
    container.querySelector<HTMLElement>('[data-action="open"]')?.focus();
  }

  function readFormInputs(): void {
    form.values.name = (container.querySelector<HTMLInputElement>('[name="name"]')?.value || '').trim();
    form.values.email = (container.querySelector<HTMLInputElement>('[name="email"]')?.value || '').trim();
    form.values.message = (container.querySelector<HTMLTextAreaElement>('[name="message"]')?.value || '').trim();
  }

  async function submitContactForm(): Promise<void> {
    readFormInputs();
    const t = cfg.texts;
    form.errors = {};
    if (!form.values.name) form.errors.name = t.errorRequired;
    if (!form.values.email) form.errors.email = t.errorRequired;
    else if (!isValidEmail(form.values.email)) form.errors.email = t.errorEmail;
    if (!form.values.message) form.errors.message = t.errorRequired;
    if (Object.keys(form.errors).length) {
      form.sendFailed = false;
      render();
      return;
    }
    const honeypot = container.querySelector<HTMLInputElement>('[name="ltb_website"]')?.value;
    if (honeypot || Date.now() - openedAt < MIN_OPEN_MS) {
      successChannel = 'contact_form';
      view = 'success';
      render();
      return;
    }
    form.sending = true;
    form.sendFailed = false;
    render();
    const ok = await sendLead(buildLeadPayload(cfg, 'contact_form', form.values), cfg.endpoint);
    form.sending = false;
    if (ok) {
      pushConversion('contact_form', { name: form.values.name, email: form.values.email });
      form.values = { name: '', email: '', message: '' };
      successChannel = 'contact_form';
      view = 'success';
    } else {
      form.sendFailed = true;
    }
    render();
  }

  function readWaInputs(): void {
    const msg = container.querySelector<HTMLInputElement>('[data-wa="message"]');
    if (msg) wa.message = msg.value.trim();
    const phone = container.querySelector<HTMLInputElement>('[data-wa="phone"]');
    if (phone) wa.phone = phone.value.trim();
  }

  function openWhatsApp(text: string): void {
    const number = (cfg.whatsapp || '').replace(/\D/g, '');
    window.open('https://wa.me/' + number + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }

  async function submitWhatsApp(): Promise<void> {
    readWaInputs();
    const normalized = normalizePhone(wa.phone, wa.country.dial);
    if (!normalized) {
      wa.error = cfg.texts.errorPhone;
      render();
      return;
    }
    wa.error = null;
    if (Date.now() - openedAt < MIN_OPEN_MS) {
      successChannel = 'whatsapp';
      view = 'success';
      render();
      return;
    }
    wa.sending = true;
    render();
    const ok = await sendLead(
      buildLeadPayload(cfg, 'whatsapp', { phone: normalized, message: wa.message }),
      cfg.endpoint,
    );
    wa.sending = false;
    if (ok) {
      pushConversion('whatsapp', { phone: normalized });
      openWhatsApp(wa.message);
      wa.step = 'compose';
      wa.message = '';
      wa.phone = '';
      successChannel = 'whatsapp';
      view = 'success';
      render();
    } else {
      wa.error = cfg.texts.errorSend;
      render();
    }
  }

  container.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target) return;
    const action = target.getAttribute('data-action')!;
    switch (action) {
      case 'open':
        open();
        break;
      case 'close':
        close();
        break;
      case 'teaser-close':
        try {
          sessionStorage.setItem(TEASER_KEY, '1');
        } catch {
          /* private mode */
        }
        render();
        break;
      case 'back':
        view = 'panel';
        wa.error = null;
        form.errors = {};
        form.sendFailed = false;
        render();
        break;
      case 'channel-contact_form':
        pushChannelClick('contact_form');
        view = 'contact_form';
        render();
        break;
      case 'channel-phone':
        pushChannelClick('phone');
        // With call tracking the real call is measured — a click-conversion
        // would double count. Without it, the click is the conversion signal.
        if (!cfg.callTracking) pushConversion('phone', {});
        break; // native tel: navigation continues
      case 'channel-whatsapp':
        pushChannelClick('whatsapp');
        view = 'whatsapp';
        wa.step = 'compose';
        render();
        break;
      case 'wa-send':
        readWaInputs();
        if (wa.message) {
          wa.step = 'phone';
          render();
          container.querySelector<HTMLInputElement>('[data-wa="phone"]')?.focus();
        }
        break;
      case 'wa-phone-send':
        void submitWhatsApp();
        break;
    }
  });

  container.addEventListener('change', (e) => {
    const el = e.target as HTMLSelectElement;
    if (el.getAttribute('data-wa') === 'country') {
      readWaInputs();
      const country = countries.find((c) => c.code === el.value);
      if (country) wa.country = country;
      render();
      container.querySelector<HTMLInputElement>('[data-wa="phone"]')?.focus();
    }
  });

  container.addEventListener('submit', (e) => {
    e.preventDefault();
    if ((e.target as HTMLElement).getAttribute('data-form') === 'contact_form') void submitContactForm();
  });

  container.addEventListener('keydown', (e) => {
    const el = e.target as HTMLElement;
    if (e.key === 'Escape' && view !== 'closed') {
      close();
      return;
    }
    if (e.key === 'Enter' && el.getAttribute('data-wa') === 'message') {
      e.preventDefault();
      container.querySelector<HTMLElement>('[data-action="wa-send"]')?.click();
      return;
    }
    if (e.key === 'Enter' && el.getAttribute('data-wa') === 'phone') {
      e.preventDefault();
      container.querySelector<HTMLElement>('[data-action="wa-phone-send"]')?.click();
      return;
    }
    if (e.key === 'Tab' && view !== 'closed') {
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>('.ltb-panel button, .ltb-panel a[href], .ltb-panel input, .ltb-panel textarea, .ltb-panel select'),
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

  render();
}
