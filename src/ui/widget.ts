import type { WidgetConfig } from '../config';
import { pushCallClick, pushChannelClick, pushLeadSubmitted, pushOpen } from '../datalayer';
import { buildLeadPayload } from '../payload';
import { sendLead } from '../transport';
import { COUNTRIES, isValidEmail, normalizePhone } from '../validate';
import { buildStyles } from './styles';
import type { FormState, WaState } from './views';
import { launcherView, messageView, panelView, successView, whatsappView } from './views';

type View = 'closed' | 'panel' | 'message' | 'whatsapp' | 'success';

const TEASER_KEY = 'ltw_teaser_dismissed';
const MIN_OPEN_MS = 2000;

export function mountWidget(cfg: WidgetConfig): void {
  if (document.getElementById('lt-widget-host')) return;

  const host = document.createElement('div');
  host.id = 'lt-widget-host';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = buildStyles(cfg);
  const container = document.createElement('div');
  container.id = 'ltw-container';
  shadow.append(style, container);
  document.body.appendChild(host);

  let view: View = 'closed';
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
    country: COUNTRIES.find((c) => c.code === cfg.defaultCountry) || COUNTRIES[0],
    pickerOpen: false,
    search: '',
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

  function injectFont(): void {
    if (document.getElementById('ltw-cairo')) return;
    const link = document.createElement('link');
    link.id = 'ltw-cairo';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap';
    document.head.appendChild(link);
  }

  function render(): void {
    const sideClass = cfg.position === 'left' ? ' ltw-left' : '';
    if (view === 'closed') {
      container.innerHTML = `<div class="ltw-root${sideClass}">${launcherView(cfg, teaserVisible())}</div>`;
      return;
    }
    const inner =
      view === 'panel'
        ? panelView(cfg)
        : view === 'message'
          ? messageView(cfg, form)
          : view === 'whatsapp'
            ? whatsappView(cfg, wa)
            : successView(cfg);
    container.innerHTML = `<div class="ltw-root${sideClass}"><div class="ltw-overlay" data-action="close"></div><div class="ltw-panel" role="dialog" aria-modal="true">${inner}</div></div>`;
    container.querySelector<HTMLElement>('.ltw-panel .ltw-close, .ltw-panel .ltw-back')?.focus();
  }

  function open(): void {
    view = 'panel';
    openedAt = Date.now();
    injectFont();
    pushOpen(cfg);
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

  async function submitMessage(): Promise<void> {
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
    const honeypot = container.querySelector<HTMLInputElement>('[name="ltw_website"]')?.value;
    if (honeypot || Date.now() - openedAt < MIN_OPEN_MS) {
      view = 'success';
      render();
      return;
    }
    form.sending = true;
    form.sendFailed = false;
    render();
    const ok = await sendLead(buildLeadPayload(cfg, 'message', form.values), cfg.endpoint);
    form.sending = false;
    if (ok) {
      pushLeadSubmitted(cfg, 'message', { name: form.values.name, email: form.values.email });
      form.values = { name: '', email: '', message: '' };
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
      pushLeadSubmitted(cfg, 'whatsapp', { phone: normalized });
      openWhatsApp(wa.message);
      wa.step = 'compose';
      wa.message = '';
      wa.phone = '';
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
      case 'channel-message':
        pushChannelClick(cfg, 'message');
        view = 'message';
        render();
        break;
      case 'channel-call':
        pushChannelClick(cfg, 'call');
        pushCallClick(cfg);
        break; // native tel: navigation continues
      case 'channel-whatsapp':
        pushChannelClick(cfg, 'whatsapp');
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
      case 'wa-cc-toggle':
        readWaInputs();
        wa.pickerOpen = !wa.pickerOpen;
        wa.search = '';
        render();
        break;
      case 'wa-country': {
        const code = target.getAttribute('data-country');
        const country = COUNTRIES.find((c) => c.code === code);
        if (country) wa.country = country;
        wa.pickerOpen = false;
        render();
        container.querySelector<HTMLInputElement>('[data-wa="phone"]')?.focus();
        break;
      }
    }
  });

  container.addEventListener('submit', (e) => {
    e.preventDefault();
    if ((e.target as HTMLElement).getAttribute('data-form') === 'message') void submitMessage();
  });

  container.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.getAttribute('data-wa') === 'search') {
      wa.search = el.value;
      const needle = wa.search.toLowerCase();
      container.querySelectorAll<HTMLElement>('.ltw-wa-country').forEach((btn) => {
        btn.style.display = btn.textContent!.toLowerCase().includes(needle) ? '' : 'none';
      });
    }
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
        container.querySelectorAll<HTMLElement>('.ltw-panel button, .ltw-panel a[href], .ltw-panel input, .ltw-panel textarea'),
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
