import type { Consent } from './types';

export const CONSENT_TYPES = [
  'ad_storage',
  'analytics_storage',
  'ad_user_data',
  'ad_personalization',
] as const;

// Google's internal consent state codes.
const GRANTED = 1;
const DENIED = 2;

declare global {
  interface Window {
    google_tag_data?: {
      ics?: { getConsentState?: (type: string) => number | undefined };
    };
  }
}

/**
 * Reads Consent Mode state from gtag's internal store.
 *
 * There is no documented client-side API for this outside GTM's own template
 * sandbox, and plenty of sites running the LeadBot have no gtag or GTM at all.
 * So every path that cannot produce a definite answer yields undefined and the
 * field is left off the payload entirely: an absent value reads as "we don't
 * know", where a filled one would claim we do.
 */
export function readConsentState(): Consent | undefined {
  let ics;
  try {
    ics = window.google_tag_data?.ics;
  } catch {
    return undefined;
  }
  if (!ics || typeof ics.getConsentState !== 'function') return undefined;

  const state: Consent = {};
  for (const type of CONSENT_TYPES) {
    let value;
    try {
      // Called as a method, never pulled out into a bare function: gtag reads
      // its own state through `this`, so an unbound call throws — and the catch
      // would quietly turn that into "unknown" on every site.
      value = ics.getConsentState(type);
    } catch {
      continue;
    }
    if (value === GRANTED) state[type] = 'granted';
    else if (value === DENIED) state[type] = 'denied';
  }
  return Object.keys(state).length > 0 ? state : undefined;
}
