import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveConfig } from '../src/config';
import { mountWhatsAppInterceptor } from '../src/ui/interceptor';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function freshMount(user: Parameters<typeof resolveConfig>[1] = {}) {
  document.getElementById('lt-leadbot-wi-host')?.remove();
  document.body.querySelectorAll('a[data-test]').forEach((a) => a.remove());
  document.documentElement.lang = 'nl';
  Object.defineProperty(window.navigator, 'language', { value: 'nl-NL', configurable: true });
  window.dataLayer = [];
  const cfg = resolveConfig('proj-1', {
    companyName: 'Voorbeeld B.V.',
    agentName: 'Nick',
    whatsapp: '+31612345678',
    whatsappInterceptor: true,
    launcher: false,
    endpoint: 'https://mock/lead',
    ...user,
  });
  mountWhatsAppInterceptor(cfg);
  const root = document.getElementById('lt-leadbot-wi-host')!.shadowRoot!;
  return { cfg, root };
}

function addLink(href: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.setAttribute('data-test', '1');
  a.textContent = 'Chat via WhatsApp';
  document.body.appendChild(a);
  return a;
}

const q = (root: ShadowRoot, sel: string) => root.querySelector(sel) as HTMLElement | null;

function clickLink(a: HTMLAnchorElement): MouseEvent {
  const e = new MouseEvent('click', { bubbles: true, cancelable: true });
  a.dispatchEvent(e);
  return e;
}

describe('WhatsApp interceptor — onderscheppen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('opens the modal on a wa.me click, prevents navigation and pushes channel_click', () => {
    const { root } = freshMount();
    const e = clickLink(addLink('https://wa.me/31698765432?text=Hoi%20Nick'));
    expect(e.defaultPrevented).toBe(true);
    expect(q(root, '.ltb-wi-modal')).toBeTruthy();
    // Zelfde begroeting als de LeadBot-WhatsApp-flow (ik-vorm door agentName)
    expect(q(root, '.ltb-wa-chat')!.textContent).toContain('Waar kan ik je mee helpen?');
    expect((q(root, '[data-wa="message"]') as HTMLInputElement).value).toBe('Hoi Nick');
    expect(window.dataLayer).toContainEqual({
      event: 'leadtrackr_leadbot_channel_click',
      channel: 'whatsapp',
    });
  });

  it('falls back to the configured number for wa.me links without a number', () => {
    const { root } = freshMount();
    const e = clickLink(addLink('https://wa.me/'));
    expect(e.defaultPrevented).toBe(true);
    expect(q(root, '.ltb-wi-modal')).toBeTruthy();
  });

  it('leaves wa.me links alone when neither link nor config has a number', () => {
    const { root } = freshMount({ whatsapp: null });
    const e = clickLink(addLink('https://wa.me/'));
    expect(e.defaultPrevented).toBe(false);
    expect(q(root, '.ltb-wi-modal')).toBeNull();
  });

  it('ignores normal links', () => {
    const { root } = freshMount();
    const a = addLink('https://example.com/contact');
    a.addEventListener('click', (ev) => ev.preventDefault()); // happy-dom-navigatie stoppen
    clickLink(a);
    expect(q(root, '.ltb-wi-modal')).toBeNull();
  });

  it('closes on Escape without opening WhatsApp', () => {
    const { root } = freshMount();
    clickLink(addLink('https://wa.me/31698765432'));
    q(root, '#ltb-container')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(q(root, '.ltb-wi-modal')).toBeNull();
  });

  it('hides the LeadBot launcher while the modal is open and restores it on close', () => {
    const lb = document.createElement('div');
    lb.id = 'lt-leadbot-host';
    document.body.appendChild(lb);
    const { root } = freshMount();
    clickLink(addLink('https://wa.me/31698765432'));
    expect(lb.style.display).toBe('none');
    q(root, '#ltb-container')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(lb.style.display).toBe('');
    lb.remove();
  });
});

describe('WhatsApp interceptor — leadflow', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('runs message → phone → POST → conversion → handoff with the link number', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    const { root } = freshMount();
    clickLink(addLink('https://wa.me/31698765432'));
    vi.setSystemTime(1_000_000 + 5000); // voorbij de 2s-botcheck

    // Eerste render speelt de modal-entree; daarna niet meer
    expect(q(root, '.ltb-wi-root')!.classList.contains('ltb-wi-static')).toBe(false);
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Wat kost het?';
    q(root, '[data-action="wa-send"]')!.click();
    expect(q(root, '.ltb-wi-root')!.classList.contains('ltb-wi-static')).toBe(true);
    expect(q(root, '.ltb-wa-chat')!.textContent).toContain(
      'Op welk telefoonnummer wil je het WhatsApp-gesprek starten?',
    );

    (q(root, '[data-wa="phone"]') as HTMLInputElement).value = '06 12345678';
    q(root, '[data-action="wa-phone-send"]')!.click();
    await vi.waitFor(() => expect(q(root, '.ltb-wi-handoff')).toBeTruthy());

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.formData.formName).toBe('LeadBot — WhatsApp Interceptor');
    expect(body.userData.phone).toBe('+31612345678');
    expect(body.formData.formFields.message).toBe('Wat kost het?');
    // Handoff naar het nummer uit de link, niet het confignummer
    expect(openSpy).toHaveBeenCalledWith(
      'https://wa.me/31698765432?text=' + encodeURIComponent('Wat kost het?'),
      '_blank',
      'noopener',
    );
    expect(window.dataLayer).toContainEqual({
      event: 'leadtrackr_leadbot_conversion',
      channel: 'whatsapp',
      user_data: { phone_number: '+31612345678' },
    });

    // Na de spinner volgt de succes-state met heropen-link
    await vi.waitFor(() => expect(q(root, '.ltb-wi-reopen')).toBeTruthy(), { timeout: 2500 });
    expect(q(root, '.ltb-wi-handoff-title')!.textContent).toBe('WhatsApp geopend');
    expect(q(root, '.ltb-wi-reopen')!.getAttribute('href')).toContain('wa.me/31698765432');
  });

  it('rejects an invalid phone number inline', () => {
    const { root } = freshMount();
    clickLink(addLink('https://wa.me/31698765432'));
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Hoi';
    q(root, '[data-action="wa-send"]')!.click();
    (q(root, '[data-wa="phone"]') as HTMLInputElement).value = '06 1';
    q(root, '[data-action="wa-phone-send"]')!.click();
    expect(q(root, '.ltb-wa-error')!.textContent).toContain('geldig telefoonnummer');
  });

  it('still opens WhatsApp with a conversion event when the lead POST fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    const { root } = freshMount();
    clickLink(addLink('https://wa.me/31698765432'));
    vi.setSystemTime(1_000_000 + 5000);
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Hoi';
    q(root, '[data-action="wa-send"]')!.click();
    (q(root, '[data-wa="phone"]') as HTMLInputElement).value = '06 12345678';
    q(root, '[data-action="wa-phone-send"]')!.click();
    await vi.waitFor(() => expect(q(root, '.ltb-wi-handoff')).toBeTruthy());
    expect(openSpy).toHaveBeenCalled();
    expect(window.dataLayer!.map((x) => x.event)).toContain('leadtrackr_leadbot_conversion');
  });

  it('skips the POST but still hands off to WhatsApp within the 2s bot window', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    const { root } = freshMount();
    clickLink(addLink('https://wa.me/31698765432'));
    (q(root, '[data-wa="message"]') as HTMLInputElement).value = 'Snel';
    q(root, '[data-action="wa-send"]')!.click();
    (q(root, '[data-wa="phone"]') as HTMLInputElement).value = '06 12345678';
    q(root, '[data-action="wa-phone-send"]')!.click();
    await vi.waitFor(() => expect(q(root, '.ltb-wi-handoff')).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalled();
    expect(window.dataLayer!.map((x) => x.event)).not.toContain('leadtrackr_leadbot_conversion');
  });
});
