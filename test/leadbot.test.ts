import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountLeadBot } from '../src/ui/leadbot';
import { resolveConfig } from '../src/config';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function freshMount(user: Parameters<typeof resolveConfig>[1] = {}) {
  document.getElementById('lt-leadbot-host')?.remove();
  document.getElementById('ltb-cairo')?.remove();
  sessionStorage.clear();
  document.documentElement.lang = 'nl';
  window.dataLayer = [];
  const cfg = resolveConfig('proj-1', {
    companyName: 'Voorbeeld B.V.',
    agentName: 'Nick',
    agentPhoto: 'avatar.png',
    phone: '+31 20 123 4567',
    whatsapp: '+31612345678',
    endpoint: 'https://mock/lead',
    ...user,
  });
  mountLeadBot(cfg);
  const root = document.getElementById('lt-leadbot-host')!.shadowRoot!;
  return { cfg, root };
}

const q = (root: ShadowRoot, sel: string) => root.querySelector(sel) as HTMLElement | null;
const click = (root: ShadowRoot, action: string) =>
  q(root, `[data-action="${action}"]`)!.click();

describe('mount + launcher + panel', () => {
  beforeEach(() => {
    document.getElementById('lt-leadbot-host')?.remove();
  });

  it('mounts a shadow root with launcher and teaser', () => {
    const { root } = freshMount();
    expect(q(root, '[data-action="open"]')).toBeTruthy();
    expect(q(root, '.ltb-teaser')!.textContent).toContain('Nick');
  });

  it('hides the teaser after dismiss and remembers it in sessionStorage', () => {
    const { root } = freshMount();
    click(root, 'teaser-close');
    expect(q(root, '.ltb-teaser')).toBeNull();
    expect(sessionStorage.getItem('ltb_teaser_dismissed')).toBe('1');
  });

  it('opens the panel, pushes leadtrackr_leadbot_open (flat), injects Cairo once', () => {
    const { root } = freshMount();
    click(root, 'open');
    expect(q(root, '.ltb-panel')).toBeTruthy();
    expect(window.dataLayer![0]).toEqual({ event: 'leadtrackr_leadbot_open' });
    expect(document.getElementById('ltb-cairo')).toBeTruthy();
    click(root, 'close');
    click(root, 'open');
    expect(document.querySelectorAll('#ltb-cairo')).toHaveLength(1);
  });

  it('shows the response time instead of an instant-reply promise', () => {
    const { root } = freshMount();
    click(root, 'open');
    expect(q(root, '.ltb-header-status')!.textContent).toBe('Gemiddelde responstijd: binnen 15 minuten');
    expect(q(root, '.ltb-header-status')!.textContent).not.toContain('direct');
  });

  it('shows the three channel buttons with agent header', () => {
    const { root } = freshMount();
    click(root, 'open');
    expect(q(root, '[data-action="channel-contact_form"]')).toBeTruthy();
    expect(q(root, '[data-action="channel-phone"]')!.getAttribute('href')).toBe('tel:+31201234567');
    expect(q(root, '[data-action="channel-whatsapp"]')).toBeTruthy();
    expect(q(root, '.ltb-header')!.textContent).toContain('Nick');
  });

  it('renders English texts when the page language is English', () => {
    document.getElementById('lt-leadbot-host')?.remove();
    document.documentElement.lang = 'en';
    window.dataLayer = [];
    const cfg = resolveConfig('proj-1', { phone: '+3120', endpoint: 'https://mock/lead' });
    mountLeadBot(cfg);
    const root = document.getElementById('lt-leadbot-host')!.shadowRoot!;
    click(root, 'open');
    expect(q(root, '.ltb-header-status')!.textContent).toBe('Average response time: within 15 minutes');
  });

  it('omits channels without configured numbers', () => {
    const { root } = freshMount({ whatsapp: null });
    click(root, 'open');
    expect(q(root, '[data-action="channel-whatsapp"]')).toBeNull();
  });

  it('phone click pushes a flat channel_click event', () => {
    const { root } = freshMount();
    click(root, 'open');
    q(root, '[data-action="channel-phone"]')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    expect(window.dataLayer).toContainEqual({
      event: 'leadtrackr_leadbot_channel_click',
      channel: 'phone',
    });
  });

  it('closes on Escape', () => {
    const { root } = freshMount();
    click(root, 'open');
    q(root, '#ltb-container')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(q(root, '.ltb-panel')).toBeNull();
    expect(q(root, '[data-action="open"]')).toBeTruthy();
  });
});

describe('contact form flow', () => {
  const openForm = (user: Parameters<typeof resolveConfig>[1] = {}) => {
    const m = freshMount(user);
    click(m.root, 'open');
    click(m.root, 'channel-contact_form');
    return m;
  };
  const fill = (root: ShadowRoot, name: string, value: string) => {
    const el = root.querySelector(`[name="${name}"]`) as HTMLInputElement;
    el.value = value;
  };
  const submit = (root: ShadowRoot) =>
    root
      .querySelector('[data-form="contact_form"]')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

  beforeEach(() => {
    document.getElementById('lt-leadbot-host')?.remove();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows validation errors and keeps values', async () => {
    const { root } = openForm();
    fill(root, 'email', 'nietgeldig');
    fill(root, 'message', 'Hoi');
    submit(root);
    await Promise.resolve();
    expect(q(root, '.ltb-field.ltb-invalid')).toBeTruthy();
    expect(root.querySelectorAll('.ltb-error')).toHaveLength(2); // name required + email invalid
    expect((root.querySelector('[name="message"]') as HTMLTextAreaElement).value).toBe('Hoi');
  });

  it('sends the lead, pushes a flat conversion event and shows success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { root } = openForm();
    vi.setSystemTime(1_000_000 + 5000); // past the 2s bot check
    fill(root, 'name', 'Jan Jansen');
    fill(root, 'email', 'jan@bedrijf.nl');
    fill(root, 'message', 'Ik heb een vraag');
    submit(root);
    await vi.waitFor(() => expect(q(root, '.ltb-success')).toBeTruthy());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.projectId).toBe('proj-1');
    expect(body.userData).toEqual({ firstName: 'Jan', lastName: 'Jansen', email: 'jan@bedrijf.nl' });
    expect(body.formData.formFields.message).toBe('Ik heb een vraag');
    expect(window.dataLayer).toContainEqual({
      event: 'leadtrackr_leadbot_conversion',
      channel: 'contact_form',
      user_data: { email_address: 'jan@bedrijf.nl', first_name: 'Jan', last_name: 'Jansen' },
    });
    expect(q(root, '.ltb-success-title')!.textContent).toBe('Bericht verzonden!');
  });

  it('drops the lead silently when the honeypot is filled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { root } = openForm();
    vi.setSystemTime(1_000_000 + 5000);
    fill(root, 'name', 'Bot');
    fill(root, 'email', 'bot@spam.nl');
    fill(root, 'message', 'spam');
    fill(root, 'ltb_website', 'https://spam.example');
    submit(root);
    await vi.waitFor(() => expect(q(root, '.ltb-success')).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drops the lead silently when submitted within 2s of opening', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { root } = openForm();
    fill(root, 'name', 'Snel');
    fill(root, 'email', 'snel@bot.nl');
    fill(root, 'message', 'x');
    submit(root);
    await vi.waitFor(() => expect(q(root, '.ltb-success')).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a retry banner when the endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const { root } = openForm();
    vi.setSystemTime(1_000_000 + 5000);
    fill(root, 'name', 'Jan');
    fill(root, 'email', 'jan@bedrijf.nl');
    fill(root, 'message', 'Hoi');
    submit(root);
    await vi.waitFor(() => expect(q(root, '.ltb-sendfail')).toBeTruthy());
    expect(window.dataLayer!.map((e) => e.event)).not.toContain('leadtrackr_leadbot_conversion');
  });
});

describe('whatsapp flow', () => {
  const openWa = () => {
    const m = freshMount();
    click(m.root, 'open');
    click(m.root, 'channel-whatsapp');
    return m;
  };

  beforeEach(() => {
    document.getElementById('lt-leadbot-host')?.remove();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders the WhatsApp compose view with greeting', () => {
    const { root } = openWa();
    expect(q(root, '.ltb-wa-chat')!.textContent).toContain('Waar kan ik je mee helpen?');
    expect(q(root, '[data-wa="message"]')).toBeTruthy();
  });

  it('asks for the WhatsApp start number after sending a message', () => {
    const { root } = openWa();
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Wat kost het?';
    click(root, 'wa-send');
    expect(q(root, '.ltb-wa-sent')!.textContent).toContain('Wat kost het?');
    expect(q(root, '.ltb-wa-chat')!.textContent).toContain(
      'Op welk telefoonnummer wil je het WhatsApp-gesprek starten?',
    );
    expect(q(root, '[data-wa="phone"]')).toBeTruthy();
  });

  it('uses a native select with a full country list, flag shown in the chip', () => {
    const { root } = openWa();
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Hoi';
    click(root, 'wa-send');
    const select = root.querySelector('select[data-wa="country"]') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.querySelectorAll('option').length).toBeGreaterThan(200);
    expect(q(root, '.ltb-wa-cc-label')!.textContent).toContain('+31');
    select.value = 'BE';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(q(root, '.ltb-wa-cc-label')!.textContent).toContain('+32');
    expect(q(root, '.ltb-wa-cc-label')!.textContent).toContain('🇧🇪');
  });

  it('rejects an invalid phone number with an inline error', () => {
    const { root } = openWa();
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Hoi';
    click(root, 'wa-send');
    (q(root, '[data-wa="phone"]') as HTMLInputElement).value = '06 12';
    click(root, 'wa-phone-send');
    expect(q(root, '.ltb-wa-error')!.textContent).toContain('geldig telefoonnummer');
  });

  it('POSTs the lead first, opens wa.me, pushes conversion and shows WhatsApp success copy', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    const { root } = openWa();
    vi.setSystemTime(1_000_000 + 5000);
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Wat kost het?';
    click(root, 'wa-send');
    (q(root, '[data-wa="phone"]') as HTMLInputElement).value = '06 12345678';
    click(root, 'wa-phone-send');
    await vi.waitFor(() => expect(q(root, '.ltb-success')).toBeTruthy());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.formData.formName).toBe('LeadBot — WhatsApp');
    expect(body.userData.phone).toBe('+31612345678');
    expect(body.formData.formFields.message).toBe('Wat kost het?');
    expect(openSpy).toHaveBeenCalledWith(
      'https://wa.me/31612345678?text=' + encodeURIComponent('Wat kost het?'),
      '_blank',
      'noopener',
    );
    expect(window.dataLayer).toContainEqual({
      event: 'leadtrackr_leadbot_conversion',
      channel: 'whatsapp',
      user_data: { phone_number: '+31612345678' },
    });
    expect(q(root, '.ltb-success-title')!.textContent).toBe('WhatsApp geopend');
    expect(q(root, '.ltb-success-body')!.textContent).toContain('nieuw tabblad');
  });
});
