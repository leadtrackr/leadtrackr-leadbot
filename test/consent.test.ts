import { afterEach, describe, expect, it } from 'vitest';
import { readConsentState } from '../src/consent';

function setIcs(getConsentState: unknown) {
  (window as any).google_tag_data = { ics: { getConsentState } };
}

afterEach(() => {
  delete (window as any).google_tag_data;
});

describe('readConsentState', () => {
  it('is undefined when there is no gtag or GTM on the page', () => {
    expect(readConsentState()).toBeUndefined();
  });

  it('is undefined when google_tag_data exists without a usable ics', () => {
    (window as any).google_tag_data = {};
    expect(readConsentState()).toBeUndefined();
    (window as any).google_tag_data = { ics: {} };
    expect(readConsentState()).toBeUndefined();
  });

  it('maps 1 to granted and 2 to denied', () => {
    setIcs((type: string) => (type === 'ad_personalization' ? 2 : 1));
    expect(readConsentState()).toEqual({
      ad_storage: 'granted',
      analytics_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'denied',
    });
  });

  it('leaves out types that return anything other than 1 or 2', () => {
    setIcs((type: string) => (type === 'ad_storage' ? 1 : undefined));
    expect(readConsentState()).toEqual({ ad_storage: 'granted' });
  });

  it('is undefined when no single type resolves', () => {
    setIcs(() => 0);
    expect(readConsentState()).toBeUndefined();
  });

  it('is undefined when the undocumented call throws', () => {
    setIcs(() => {
      throw new Error('gone');
    });
    expect(readConsentState()).toBeUndefined();
  });
});
