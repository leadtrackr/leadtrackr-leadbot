import { getDynamicNumber } from '../calltracking';
import type { LeadBotConfig } from '../config';
import { getCountries, type Country } from '../countries';
import { pushChannelClick, pushConversion, pushOpen } from '../datalayer';
import { buildLeadPayload } from '../payload';
import { sendLead } from '../transport';
import { isValidEmail, normalizePhone } from '../validate';
import { buildStyles } from './styles';
import { trackVisualViewport } from './viewport';
import type { FormDef } from '../forms';
import type { FormState, WaState } from './views';
import { autoGrowMessage, formView, launcherView, panelView, successView, whatsappView } from './views';

type View = 'closed' | 'panel' | 'form' | 'whatsapp' | 'success';

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
  trackVisualViewport(container);

  const countries = getCountries(cfg.language);

  const defaultCountry = countries.find((c) => c.code === cfg.defaultCountry) || countries[0];

  let view: View = 'closed';
  let success = { title: '', body: '', whatsapp: false };
  let openedAt = 0;

  function blankForm(def: FormDef): FormState {
    const forCountries: Record<string, Country> = {};
    for (const f of def.fields) if (f.type === 'tel') forCountries[f.key] = defaultCountry;
    return { def, values: {}, countries: forCountries, errors: {}, sending: false, sendFailed: false };
  }

  let form: FormState = blankForm(cfg.forms.contact_form);
  const wa: WaState = {
    step: 'compose',
    entered: false,
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
        : view === 'form'
          ? formView(cfg, form, countries)
          : view === 'whatsapp'
            ? whatsappView(cfg, wa, countries)
            : successView(cfg, success);
    container.innerHTML = `<div class="ltb-root${sideClass}"><div class="ltb-overlay" data-action="close"></div><div class="ltb-panel" role="dialog" aria-modal="true"><div class="ltb-view">${inner}</div></div></div>`;
    const msg = container.querySelector<HTMLTextAreaElement>('textarea[data-wa="message"]');
    if (msg) autoGrowMessage(msg);
    // Nieuwste bubbel (bijv. de nummer-vraag) altijd in beeld
    const chat = container.querySelector<HTMLElement>('.ltb-wa-chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
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
    for (const f of form.def.fields) {
      const el = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${f.key}"]`);
      if (el) form.values[f.key] = el.value.trim();
    }
  }

  function showFormSuccess(def: FormDef): void {
    success = { title: def.successTitle, body: def.successBody, whatsapp: false };
    view = 'success';
  }

  function openForm(id: string): void {
    const def = cfg.forms[id];
    if (!def) return;
    pushChannelClick(id);
    form = blankForm(def);
    view = 'form';
    render();
  }

  async function submitForm(): Promise<void> {
    readFormInputs();
    const t = cfg.texts;
    const def = form.def;
    form.errors = {};
    // Alleen ingevulde, geldige waarden gaan mee; een leeg optioneel veld
    // hoort niet als lege string in LeadTrackr te belanden.
    const values: Record<string, string> = {};
    for (const f of def.fields) {
      const raw = (form.values[f.key] || '').trim();
      if (!raw) {
        if (f.required) form.errors[f.key] = t.errorRequired;
        continue;
      }
      if (f.type === 'email' && !isValidEmail(raw)) {
        form.errors[f.key] = t.errorEmail;
        continue;
      }
      if (f.type === 'tel') {
        const normalized = normalizePhone(raw, (form.countries[f.key] || defaultCountry).dial);
        if (!normalized) form.errors[f.key] = t.errorPhone;
        else values[f.key] = normalized;
        continue;
      }
      values[f.key] = raw;
    }
    if (Object.keys(form.errors).length) {
      form.sendFailed = false;
      render();
      return;
    }
    const honeypot = container.querySelector<HTMLInputElement>('[name="ltb_website"]')?.value;
    if (honeypot || Date.now() - openedAt < MIN_OPEN_MS) {
      showFormSuccess(def);
      render();
      return;
    }
    form.sending = true;
    form.sendFailed = false;
    render();
    const res = await sendLead(buildLeadPayload(cfg, def.formName, values), cfg.endpoint);
    form.sending = false;
    if (res.ok) {
      pushConversion(def.id, { name: values.name, email: values.email, phone: values.phone });
      form.values = {};
      showFormSuccess(def);
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

  function showWaSuccess(): void {
    success = { title: cfg.texts.waSuccessTitle, body: cfg.texts.waSuccessBody, whatsapp: true };
    view = 'success';
  }

  function openWhatsApp(text: string): void {
    const number = (cfg.whatsapp || '').replace(/\D/g, '');
    window.open('https://wa.me/' + number + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
  }

  async function submitWhatsApp(): Promise<void> {
    // De compose-knop heeft geen disabled-state; zonder deze guard levert
    // dubbelklikken twee POSTs op.
    if (wa.sending) return;
    readWaInputs();
    // Met de nummervraag uit gaat de lead zonder telefoonnummer de deur uit;
    // bericht, pagina-context en attributie blijven wel behouden.
    const normalized = cfg.whatsappPhoneQuestion ? normalizePhone(wa.phone, wa.country.dial) : null;
    if (cfg.whatsappPhoneQuestion && !normalized) {
      wa.error = cfg.texts.errorPhone;
      render();
      return;
    }
    wa.error = null;
    if (Date.now() - openedAt < MIN_OPEN_MS) {
      showWaSuccess();
      render();
      return;
    }
    wa.sending = true;
    render();
    const res = await sendLead(
      buildLeadPayload(cfg, cfg.formNames.whatsapp, { phone: normalized || undefined, message: wa.message }),
      cfg.endpoint,
    );
    wa.sending = false;
    // 404 = project niet gevonden, 403 = abonnement inactief: bewust blokkeren
    // (betaal-check). Elke andere fout mag de bezoeker nooit in de weg zitten:
    // WhatsApp opent gewoon en het conversie-event gaat mee.
    if (res.status === 404 || res.status === 403) {
      // De warn blijft altijd staan, ook bij een vrijgestelde klant: in de
      // console moet zichtbaar zijn wat de API zei.
      console.warn(
        '[LeadTrackr LeadBot] Lead geblokkeerd: ' +
          (res.status === 403 ? 'abonnement inactief (403)' : 'project niet gevonden (404)'),
      );
      if (cfg.subscriptionCheck) {
        wa.error = cfg.texts.errorBlocked;
        render();
        return;
      }
    }
    pushConversion('whatsapp', normalized ? { phone: normalized } : {});
    openWhatsApp(wa.message);
    wa.step = 'compose';
    wa.entered = false;
    wa.message = '';
    wa.phone = '';
    showWaSuccess();
    render();
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
        wa.entered = false;
        render();
        break;
      case 'wa-send':
        readWaInputs();
        if (!wa.message) break;
        // Zonder nummervraag is dit meteen de verzendknop
        if (!cfg.whatsappPhoneQuestion) {
          void submitWhatsApp();
          break;
        }
        wa.step = 'phone';
        wa.entered = false;
        render();
        wa.entered = true; // volgende renders spelen de sequence niet opnieuw
        container.querySelector<HTMLInputElement>('[data-wa="phone"]')?.focus();
        break;
      case 'wa-phone-send':
        void submitWhatsApp();
        break;
      default:
        // Elk ander kanaal is een formulier uit de config.
        if (action.slice(0, 8) === 'channel-') openForm(action.slice(8));
    }
  });

  container.addEventListener('change', (e) => {
    const el = e.target as HTMLSelectElement;
    const telField = el.getAttribute('data-cc');
    if (telField) {
      readFormInputs();
      const country = countries.find((c) => c.code === el.value);
      if (country) form.countries[telField] = country;
      render();
      container.querySelector<HTMLInputElement>(`[name="${telField}"]`)?.focus();
      return;
    }
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
    if ((e.target as HTMLElement).hasAttribute('data-form')) void submitForm();
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
    if (e.key === 'Escape' && view !== 'closed') {
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
