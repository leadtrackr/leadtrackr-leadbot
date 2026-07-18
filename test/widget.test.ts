import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountWidget } from '../src/ui/widget';
import { resolveConfig } from '../src/config';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function freshMount(user: Parameters<typeof resolveConfig>[1] = {}) {
  document.getElementById('lt-widget-host')?.remove();
  document.getElementById('ltw-cairo')?.remove();
  sessionStorage.clear();
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
  mountWidget(cfg);
  const root = document.getElementById('lt-widget-host')!.shadowRoot!;
  return { cfg, root };
}

const q = (root: ShadowRoot, sel: string) => root.querySelector(sel) as HTMLElement | null;
const click = (root: ShadowRoot, action: string) =>
  q(root, `[data-action="${action}"]`)!.click();

describe('mount + launcher + panel', () => {
  beforeEach(() => {
    document.getElementById('lt-widget-host')?.remove();
  });

  it('mounts a shadow root with launcher and teaser', () => {
    const { root } = freshMount();
    expect(q(root, '[data-action="open"]')).toBeTruthy();
    expect(q(root, '.ltw-teaser')!.textContent).toContain('Nick');
  });

  it('hides the teaser after dismiss and remembers it in sessionStorage', () => {
    const { root } = freshMount();
    click(root, 'teaser-close');
    expect(q(root, '.ltw-teaser')).toBeNull();
    expect(sessionStorage.getItem('ltw_teaser_dismissed')).toBe('1');
  });

  it('opens the panel, pushes leadtrackr_widget_open, injects Cairo once', () => {
    const { root } = freshMount();
    click(root, 'open');
    expect(q(root, '.ltw-panel')).toBeTruthy();
    expect(window.dataLayer![0]).toMatchObject({ event: 'leadtrackr_widget_open' });
    expect(document.getElementById('ltw-cairo')).toBeTruthy();
    click(root, 'close');
    click(root, 'open');
    expect(document.querySelectorAll('#ltw-cairo')).toHaveLength(1);
  });

  it('shows the three channel buttons with agent header', () => {
    const { root } = freshMount();
    click(root, 'open');
    expect(q(root, '[data-action="channel-message"]')).toBeTruthy();
    expect(q(root, '[data-action="channel-call"]')!.getAttribute('href')).toBe('tel:+31201234567');
    expect(q(root, '[data-action="channel-whatsapp"]')).toBeTruthy();
    expect(q(root, '.ltw-header')!.textContent).toContain('Nick');
  });

  it('omits channels without configured numbers', () => {
    const { root } = freshMount({ whatsapp: null });
    click(root, 'open');
    expect(q(root, '[data-action="channel-whatsapp"]')).toBeNull();
  });

  it('call click pushes call_click with the business number', () => {
    const { root } = freshMount();
    click(root, 'open');
    q(root, '[data-action="channel-call"]')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    const events = window.dataLayer!.map((e) => e.event);
    expect(events).toContain('leadtrackr_widget_call_click');
  });

  it('closes on Escape', () => {
    const { root } = freshMount();
    click(root, 'open');
    q(root, '#ltw-container')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(q(root, '.ltw-panel')).toBeNull();
    expect(q(root, '[data-action="open"]')).toBeTruthy();
  });
});

describe('message form flow', () => {
  const openForm = (user: Parameters<typeof resolveConfig>[1] = {}) => {
    const m = freshMount(user);
    click(m.root, 'open');
    click(m.root, 'channel-message');
    return m;
  };
  const fill = (root: ShadowRoot, name: string, value: string) => {
    const el = root.querySelector(`[name="${name}"]`) as HTMLInputElement;
    el.value = value;
  };
  const submit = (root: ShadowRoot) =>
    root
      .querySelector('[data-form="message"]')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

  beforeEach(() => {
    document.getElementById('lt-widget-host')?.remove();
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
    expect(q(root, '.ltw-field.ltw-invalid')).toBeTruthy();
    expect(root.querySelectorAll('.ltw-error')).toHaveLength(2); // name required + email invalid
    expect((root.querySelector('[name="message"]') as HTMLTextAreaElement).value).toBe('Hoi');
  });

  it('sends the lead, pushes lead_submitted and shows success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { root } = openForm();
    vi.setSystemTime(1_000_000 + 5000); // past the 2s bot check
    fill(root, 'name', 'Jan Jansen');
    fill(root, 'email', 'jan@bedrijf.nl');
    fill(root, 'message', 'Ik heb een vraag');
    submit(root);
    await vi.waitFor(() => expect(q(root, '.ltw-success')).toBeTruthy());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.projectId).toBe('proj-1');
    expect(body.userData).toEqual({ firstName: 'Jan', lastName: 'Jansen', email: 'jan@bedrijf.nl' });
    expect(body.formData.formFields.message).toBe('Ik heb een vraag');
    const events = window.dataLayer!.map((e) => e.event);
    expect(events).toContain('leadtrackr_widget_lead_submitted');
  });

  it('drops the lead silently when the honeypot is filled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { root } = openForm();
    vi.setSystemTime(1_000_000 + 5000);
    fill(root, 'name', 'Bot');
    fill(root, 'email', 'bot@spam.nl');
    fill(root, 'message', 'spam');
    fill(root, 'ltw_website', 'https://spam.example');
    submit(root);
    await vi.waitFor(() => expect(q(root, '.ltw-success')).toBeTruthy());
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
    await vi.waitFor(() => expect(q(root, '.ltw-success')).toBeTruthy());
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
    await vi.waitFor(() => expect(q(root, '.ltw-sendfail')).toBeTruthy());
    expect(window.dataLayer!.map((e) => e.event)).not.toContain('leadtrackr_widget_lead_submitted');
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
    document.getElementById('lt-widget-host')?.remove();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders the WhatsApp compose view with greeting', () => {
    const { root } = openWa();
    expect(q(root, '.ltw-wa-chat')!.textContent).toContain('Waar kunnen we je mee helpen?');
    expect(q(root, '[data-wa="message"]')).toBeTruthy();
  });

  it('moves to the phone step after typing and sending a message', () => {
    const { root } = openWa();
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Wat kost het?';
    click(root, 'wa-send');
    expect(q(root, '.ltw-wa-sent')!.textContent).toContain('Wat kost het?');
    expect(q(root, '[data-wa="phone"]')).toBeTruthy();
  });

  it('switches country via the picker', () => {
    const { root } = openWa();
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Hoi';
    click(root, 'wa-send');
    click(root, 'wa-cc-toggle');
    (root.querySelector('[data-country="BE"]') as HTMLElement).click();
    expect(q(root, '.ltw-wa-cc')!.textContent).toContain('+32');
  });

  it('rejects an invalid phone number with an inline error', () => {
    const { root } = openWa();
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Hoi';
    click(root, 'wa-send');
    (q(root, '[data-wa="phone"]') as HTMLInputElement).value = '06 12';
    click(root, 'wa-phone-send');
    expect(q(root, '.ltw-wa-error')!.textContent).toContain('geldig telefoonnummer');
  });

  it('POSTs the lead first, then opens wa.me with the typed message, then shows success', async () => {
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
    await vi.waitFor(() => expect(q(root, '.ltw-success')).toBeTruthy());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.formData.formName).toBe('Widget — WhatsApp');
    expect(body.userData.phone).toBe('+31612345678');
    expect(body.formData.formFields.message).toBe('Wat kost het?');
    expect(openSpy).toHaveBeenCalledWith(
      'https://wa.me/31612345678?text=' + encodeURIComponent('Wat kost het?'),
      '_blank',
      'noopener',
    );
    const lead = window.dataLayer!.find((e) => e.event === 'leadtrackr_widget_lead_submitted');
    expect(lead).toBeTruthy();
  });
});
