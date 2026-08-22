import { getCookie } from './cookies';
import { readConsentState } from './consent';
import type { AttributionData, Consent } from './types';

/**
 * Where each field is found: URL parameter first, then the cookies the
 * platform's own pixel writes. The parameter is the freshest copy and is there
 * even when the pixel is absent, consent-blocked, or slow to write.
 *
 * Cookies are only read, never created — an ID we invent is one the platform
 * cannot match. Browser IDs have no URL parameter for that reason.
 */
const CLICK_ID_SOURCES: Record<string, [string, string[]]> = {
  ttclid: ['ttclid', ['ttclid']],
  ttp: ['', ['_ttp']],
  li_fat_id: ['li_fat_id', ['li_fat_id']],
  // Snapchat capitalises its parameter where nobody else does.
  scclid: ['ScCid', ['_scclid']],
  scid: ['', ['_scid']],
  // rdt_cid without the underscore is what Reddit's older pixel wrote.
  rdt_cid: ['rdt_cid', ['_rdt_cid', 'rdt_cid']],
  rdt_uuid: ['', ['_rdt_uuid']],
  epik: ['epik', ['_epik']],
  twclid: ['twclid', ['twclid']],
  // OpenAI's cookies are its parameter with a __ prefix.
  oppref: ['oppref', ['__oppref']],
  obref: ['', ['__obref']],
  uetvid: ['', ['uet_vid', '_uetvid']],
};

function firstOf(p: URLSearchParams, param: string, cookies: string[]): string {
  if (param) {
    const fromUrl = p.get(param);
    if (fromUrl) return fromUrl;
  }
  for (const name of cookies) {
    const value = getCookie(name);
    if (value) return value;
  }
  return '';
}

/**
 * Pulls the ID out of a _gcl container. The browser tag wraps it in a
 * dot-separated value whose last segment is the ID; a server-side container
 * wraps it between ".k" and "$i". _gcl_ag carries the server-side format even
 * though the browser tag writes it.
 */
function unwrapGcl(value: string | null, serverFormat: boolean): string {
  if (!value) return '';
  if (serverFormat) return value.match(/\.k(.+)\$i/)?.[1] || '';
  if (value.indexOf('.') === -1) return '';
  const parts = value.split('.');
  return parts[parts.length - 1] || '';
}

// GTM parity: parts.length-1 for subdomains, else 1.
function subDomainIndex(hostname: string): number {
  const parts = hostname.split('.');
  return parts.length > 2 ? parts.length - 1 : 1;
}

export function collectAttribution(
  search: string,
  hostname: string,
  now: number,
  conversionPage = '',
  consent?: Consent,
): AttributionData {
  const p = new URLSearchParams(search);

  const google = (
    param: string,
    serverCookie: string,
    browserCookie: string,
    browserUsesServerFormat = false,
  ): string =>
    p.get(param) ||
    unwrapGcl(getCookie(serverCookie), true) ||
    unwrapGcl(getCookie(browserCookie), browserUsesServerFormat);

  const gclid = google('gclid', 'FPGCLAW', '_gcl_aw');
  const wbraid = google('wbraid', 'FPGCLGB', '_gcl_gb');
  const gbraid = google('gbraid', 'FPGCLAG', '_gcl_ag', true);
  // Collected but not actionable: Google Ads' ClickConversion takes gclid,
  // gbraid or wbraid only. dclid belongs to Campaign Manager 360 and DV360.
  const dclid = google('dclid', 'FPGCLDC', '_gcl_dc');

  // UET's browser pixel writes the cookie's own name into its value, so
  // "_uet561f11…" has to be sent as "561f11…". A server-side container writes
  // the same ID to uet_msclkid without the prefix.
  const msclkid = firstOf(p, 'msclkid', ['uet_msclkid', '_uetmsclkid']).replace(/^_uet/, '');

  const channels: Record<string, string> = {};
  for (const [field, [param, cookies]] of Object.entries(CLICK_ID_SOURCES)) {
    channels[field] = firstOf(p, param, cookies);
  }

  let fbc = getCookie('_fbc') || '';
  const fbclid = p.get('fbclid');
  if (fbclid) {
    const current = fbc.split('.').pop();
    if (!fbc || current !== fbclid) {
      fbc = 'fb.' + subDomainIndex(hostname) + '.' + now + '.' + encodeURIComponent(fbclid);
    }
  }

  const fbp = getCookie('_fbp') || '';

  let cid = '';
  const ga = getCookie('_ga');
  if (ga) {
    const parts = ga.split('.');
    if (parts.length >= 4) cid = parts[2] + '.' + parts[3];
  }

  const data: AttributionData = {
    fbc, fbp, cid, conversionPage,
    gclid, wbraid, gbraid, dclid, msclkid,
    ...channels,
  } as AttributionData;
  // Left off entirely when undetermined, rather than sent as a guess.
  if (consent) data.consent = consent;
  return data;
}

export function collectAttributionFromPage(): AttributionData {
  return collectAttribution(
    location.search,
    location.hostname,
    Date.now(),
    location.host + location.pathname,
    readConsentState(),
  );
}
