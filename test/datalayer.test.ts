import { beforeEach, describe, expect, it } from 'vitest';
import { pushChannelClick, pushConversion, pushOpen } from '../src/datalayer';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

describe('datalayer (LeadBot events, flat contract)', () => {
  beforeEach(() => {
    window.dataLayer = undefined;
  });

  it('pushes leadtrackr_leadbot_open with only the event field', () => {
    pushOpen();
    expect(window.dataLayer).toEqual([{ event: 'leadtrackr_leadbot_open' }]);
  });

  it('pushes channel_click with the channel at top level', () => {
    pushChannelClick('whatsapp');
    pushChannelClick('phone');
    pushChannelClick('contact_form');
    expect(window.dataLayer).toEqual([
      { event: 'leadtrackr_leadbot_channel_click', channel: 'whatsapp' },
      { event: 'leadtrackr_leadbot_channel_click', channel: 'phone' },
      { event: 'leadtrackr_leadbot_channel_click', channel: 'contact_form' },
    ]);
  });

  it('pushes conversion with only event, channel and user_data', () => {
    pushConversion('whatsapp', { phone: '+31612345678' });
    expect(window.dataLayer).toEqual([
      {
        event: 'leadtrackr_leadbot_conversion',
        channel: 'whatsapp',
        user_data: { phone_number: '+31612345678' },
      },
    ]);
  });

  it('includes name and email fields for contact_form conversions', () => {
    pushConversion('contact_form', { name: 'Lester Visser', email: 'example@email.com' });
    expect(window.dataLayer![0]).toEqual({
      event: 'leadtrackr_leadbot_conversion',
      channel: 'contact_form',
      user_data: {
        email_address: 'example@email.com',
        first_name: 'Lester',
        last_name: 'Visser',
      },
    });
  });
});
