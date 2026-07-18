import { beforeEach, describe, expect, it } from 'vitest';
import { pushCallClick, pushChannelClick, pushLeadSubmitted, pushOpen } from '../src/datalayer';
import { resolveConfig } from '../src/config';
import { updateChannelFlow } from '../src/channelflow';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function clearCookies() {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = name + '=;max-age=0;path=/';
  }
}

describe('datalayer', () => {
  const cfg = resolveConfig('proj-1', { phone: '+31201234567' });

  beforeEach(() => {
    clearCookies();
    window.dataLayer = undefined;
  });

  it('creates dataLayer and pushes the open event', () => {
    pushOpen(cfg);
    expect(window.dataLayer).toHaveLength(1);
    expect(window.dataLayer![0]).toMatchObject({
      event: 'leadtrackr_widget_open',
      leadtrackr: { project_id: 'proj-1', widget_version: 'test' },
    });
  });

  it('pushes channel_click and call_click', () => {
    pushChannelClick(cfg, 'whatsapp');
    pushCallClick(cfg);
    expect(window.dataLayer![0]).toMatchObject({
      event: 'leadtrackr_widget_channel_click',
      leadtrackr: { channel: 'whatsapp' },
    });
    expect(window.dataLayer![1]).toMatchObject({
      event: 'leadtrackr_widget_call_click',
      leadtrackr: { channel: 'call', phone_number: '+31201234567' },
    });
  });

  it('pushes lead_submitted with user_provided_data in Google EC schema and an attribution snapshot', () => {
    updateChannelFlow('?utm_source=google&utm_medium=cpc&utm_campaign=zomer', '', 'klant.nl', 1000);
    pushLeadSubmitted(cfg, 'message', {
      name: 'Jan Jansen',
      email: 'jan@bedrijf.nl',
      phone: '+31612345678',
    });
    const e = window.dataLayer![0] as Record<string, never>;
    expect(e.event).toBe('leadtrackr_widget_lead_submitted');
    expect(e.user_provided_data).toEqual({
      email: 'jan@bedrijf.nl',
      phone_number: '+31612345678',
      address: [{ first_name: 'Jan', last_name: 'Jansen' }],
    });
    expect(e.leadtrackr).toMatchObject({
      channel: 'message',
      form_name: 'Widget — Bericht',
      attribution: { source: 'google', medium: 'cpc', campaign: 'zomer' },
    });
  });
});
