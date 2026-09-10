import { getDynamicNumber } from '../calltracking';
import { resolveChannel } from '../channels';
import type { LeadBotConfig } from '../config';
import { getCountries, type Country } from '../countries';
import { pushChannelClick, pushConversion, pushOpen } from '../datalayer';
import { buildLeadPayload } from '../payload';
import { sendLead } from '../transport';
import { isValidEmail, isValidNumber, normalizePhone } from '../validate';
import { buildStyles } from './styles';
import { trackVisualViewport } from './viewport';
import type { FormDef } from '../forms';
import type { FormState, WaState } from './views';
import { autoGrowMessage, formView, launcherView, panelView, successView, whatsappView } from './views';
import { threadView, type ThreadState } from './thread';
import { answerQuestion, backToMenu, menuThread, openFaq } from './threadflow';

type View = 'closed' | 'panel' | 'form' | 'whatsapp' | 'success' | 'thread';

// Hoe lang de bot "typt" voordat een antwoord verschijnt. Vaste waarde: lang
// genoeg om als antwoord te lezen, kort genoeg om niet te vertragen.
const TYPING_MS = 620;

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
  // Waar 'terug' naartoe gaat vanuit een formulier of de WhatsApp-flow.
  let returnTo: View = 'panel';
  let thread: ThreadState = { channel: null, messages: [], chips: [], typing: false, fresh: 0 };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  // Welke view er bij de vorige render stond; een herrender binnen dezelfde
  // view mag de openings-animatie niet opnieuw afspelen.
  let renderedView: View = 'closed';

  function render(): void {
    const sideClass = cfg.position === 'left' ? ' ltb-left' : '';
    const instant = renderedView === view ? ' ltb-instant' : '';
    renderedView = view;
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
            : view === 'thread'
              ? threadView(cfg, thread, { back: returnTo === 'panel' })
              : successView(cfg, success);
    container.innerHTML = `<div class="ltb-root${sideClass}${instant}"><div class="ltb-overlay" data-action="close"></div><div class="ltb-panel" role="dialog" aria-modal="true"><div class="ltb-view">${inner}</div></div></div>`;
    const msg = container.querySelector<HTMLTextAreaElement>('textarea[data-wa="message"]');
    if (msg) autoGrowMessage(msg);
    // Nieuwste bubbel (bijv. de nummer-vraag) altijd in beeld
    const chat = container.querySelector<HTMLElement>('.ltb-wa-chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
    const thread$ = container.querySelector<HTMLElement>('.ltb-thread');
    if (thread$) thread$.scrollTop = thread$.scrollHeight;
    container.querySelector<HTMLElement>('.ltb-panel .ltb-close, .ltb-panel .ltb-back')?.focus();
  }

  function open(): void {
    // In gespreksmodus is de thread de ingang; `returnTo` wijst daarom naar de
    // thread, zodat 'terug' uit een formulier in het gesprek uitkomt en er
    // bovenin geen terugknop naar een lijst staat die niet bestaat.
    view = cfg.conversational ? 'thread' : 'panel';
    returnTo = view;
    if (cfg.conversational) {
      thread = menuThread(cfg);
      openedAt = Date.now();
      pushOpen();
      render();
      thread = { ...thread, fresh: 0 };
      return;
    }
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
      // Een keuzegroep is meer dan één input; de aangevinkte values samen
      // vormen de waarde. Niets aangevinkt geeft een lege string, en die valt
      // verderop vanzelf in de verplicht-controle.
      if (f.type === 'checkbox') {
        const boxes = Array.from(
          container.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${f.key}"]`),
        );
        form.values[f.key] = boxes
          .filter((b) => b.checked)
          .map((b) => b.value)
          .join(', ');
        continue;
      }
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

  /** Laat de bot even typen en toon daarna de volgende toestand. */
  function withTyping(next: () => ThreadState): void {
    thread = { ...thread, typing: true, fresh: 0 };
    render();
    const show = (): void => {
      thread = next();
      render();
      // Vanaf de volgende render staat alles stil; de animatie speelt één keer.
      thread = { ...thread, fresh: 0 };
    };
    if (reducedMotion) show();
    else setTimeout(show, TYPING_MS);
  }

  /**
   * Eén pad voor het kiezen van een kanaal, of dat nu via een knop in het
   * paneel gebeurt of via een chip in het gesprek. Zo kan de meting niet
   * uiteenlopen tussen de twee ingangen.
   */
  function selectChannel(id: string, from: 'panel' | 'thread'): void {
    const resolved = resolveChannel(cfg, id);
    if (!resolved) return;
    if (resolved.kind === 'phone') {
      pushChannelClick('phone');
      if (from === 'panel') {
        // De kanaalknop is zelf de tel:-link; met call tracking meet het
        // gesprek de conversie, anders is de klik het signaal.
        if (!cfg.callTracking) pushConversion('phone', {});
        return;
      }
      const display = (cfg.callTracking ? getDynamicNumber(cfg.callTracking.prefix, cfg.callTracking.swapGroup)?.display : null) || cfg.phone || '';
      withTyping(() => ({
        ...thread,
        messages: [...thread.messages, { from: 'user', text: cfg.texts.callTitle }, { from: 'bot', text: display, button: { label: display, url: 'tel:' + display.replace(/[\s-]/g, '') } }],
        chips: [{ id: 'restart', label: cfg.texts.threadRestart, style: 'quiet' }],
        typing: false,
        fresh: 2,
      }));
      return;
    }
    if (resolved.kind === 'whatsapp') {
      pushChannelClick('whatsapp');
      returnTo = from === 'thread' ? 'thread' : 'panel';
      view = 'whatsapp';
      wa.step = 'compose';
      wa.entered = false;
      render();
      return;
    }
    if (resolved.kind === 'link') {
      pushChannelClick(id);
      // In het paneel navigeert de <a> zelf; in een gesprek verschijnt de
      // kaart als bericht met een knop eronder.
      if (from === 'panel') return;
      const def = resolved.def;
      withTyping(() => ({
        ...thread,
        messages: [...thread.messages, { from: 'user', text: def.title }, { from: 'bot', text: def.message || def.title, button: def.button }],
        chips: [{ id: 'restart', label: cfg.texts.threadRestart, style: 'quiet' }],
        typing: false,
        fresh: 2,
      }));
      return;
    }
    if (resolved.kind === 'faq') {
      pushChannelClick(id);
      const def = resolved.def;
      returnTo = from === 'thread' ? 'thread' : 'panel';
      if (from === 'panel') {
        thread = openFaq(cfg, def);
        view = 'thread';
        render();
        thread = { ...thread, fresh: 0 };
        return;
      }
      withTyping(() => openFaq(cfg, def));
      return;
    }
    returnTo = from === 'thread' ? 'thread' : 'panel';
    openForm(id);
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
      if (f.type === 'number') {
        // Vangnet: een native number-input schoont tekst zelf al op, dus dit
        // slaat alleen aan bij een browser die dat niet doet.
        if (!isValidNumber(raw)) {
          form.errors[f.key] = t.errorNumber;
          continue;
        }
        const n = Number(raw.replace(',', '.'));
        if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) {
          form.errors[f.key] = t.errorRange;
          continue;
        }
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
        view = returnTo;
        wa.error = null;
        form.errors = {};
        form.sendFailed = false;
        render();
        break;
      case 'channel-phone':
        selectChannel('phone', 'panel');
        break; // native tel: navigation continues
      case 'channel-whatsapp':
        selectChannel('whatsapp', 'panel');
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
      default: {
        if (action.slice(0, 8) === 'channel-') {
          selectChannel(action.slice(8), 'panel');
          break;
        }
        if (action.slice(0, 5) !== 'chip-') break;
        const chip = action.slice(5);
        if (chip === 'restart') {
          // Terug naar waar het gesprek begon. In gespreksmodus is dat het
          // menu; in lijstmodus bestaat dat menu niet in de thread, dus daar
          // is het de vragenlijst van de FAQ zelf.
          const faq = thread.channel ? cfg.faqs[thread.channel] : null;
          if (cfg.conversational) withTyping(() => backToMenu(cfg, thread));
          else if (faq) withTyping(() => openFaq(cfg, faq));
          else {
            view = 'panel';
            render();
          }
          break;
        }
        if (chip.slice(0, 1) === 'q' && /^q\d+$/.test(chip)) {
          const faq = thread.channel ? cfg.faqs[thread.channel] : null;
          if (!faq) break;
          const index = Number(chip.slice(1));
          const question = faq.questions[index];
          if (!question) break;
          // De vraag verschijnt meteen als bericht van de bezoeker; het
          // antwoord komt na de typ-indicator.
          thread = {
            ...thread,
            messages: [...thread.messages, { from: 'user', text: question.q }],
            chips: [],
            fresh: 1,
          };
          withTyping(() => {
            const next = answerQuestion(cfg, faq, { ...thread, messages: thread.messages.slice(0, -1) }, index);
            return next;
          });
          break;
        }
        selectChannel(chip, 'thread');
      }
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
