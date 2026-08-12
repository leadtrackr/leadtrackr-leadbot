import { getCookie, setCookie } from './cookies';
import type { Channel, ChannelFlowEntry } from './types';

export const CHANNEL_FLOW_COOKIE = 'lt_channelflow';
export const SESSION_COOKIE = 'lt_session';

const MAX_AGE_SECONDS = 395 * 86400;
// GTM-tag default. The tag exposes this per container; here it is fixed.
const SESSION_TIMEOUT_SECONDS = 30 * 60;

// A Channel Flow entry marks the start of a session, so the array only grows
// for returning visitors. Both limits guard the 4KB browser cookie limit: past
// it the cookie is silently rejected and the whole journey is lost.
const MAX_ENTRIES = 25;
const MAX_COOKIE_LENGTH = 3500;

const SEARCH_ENGINE_LABELS = [
  'google', 'bing', 'yahoo', 'duckduckgo', 'baidu',
  'ecosia', 'yandex', 'startpage', 'qwant', 'brave', 'naver',
];
const SECOND_LEVEL_DOMAINS = ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac', 'mil'];
const GOOGLE_CLICK_IDS = ['gclid', 'gbraid', 'wbraid'];

// Returns the registrable part of a host: www.google.nl -> google.nl,
// www.google.co.uk -> google.co.uk. Matching on this instead of the full host
// is what makes every country domain resolve to the same search engine.
export function registrableDomain(host: string): string {
  if (!host) return '';
  const parts = host.split('.');
  if (parts.length <= 2) return host;

  const take = SECOND_LEVEL_DOMAINS.indexOf(parts[parts.length - 2]) > -1 ? 3 : 2;
  if (parts.length <= take) return host;
  return parts.slice(parts.length - take).join('.');
}

function domainLabel(host: string): string {
  const registrable = registrableDomain(host);
  return registrable ? registrable.split('.')[0] : '';
}

function utmChannel(p: URLSearchParams): Channel | null {
  const channel: Channel = {} as Channel;
  let hasAny = false;

  const mapping: Array<[keyof Channel, string]> = [
    ['s', 'utm_source'], ['m', 'utm_medium'], ['cm', 'utm_campaign'],
    ['ct', 'utm_content'], ['tm', 'utm_term'],
  ];
  for (const [key, param] of mapping) {
    const value = p.get(param);
    if (value) {
      channel[key] = value;
      hasAny = true;
    }
  }
  if (!hasAny) return null;

  if (!channel.s) channel.s = '(not set)';
  if (!channel.m) channel.m = '(not set)';
  return channel;
}

// Click IDs count only when present in this pageview's query string. Reading
// them from _gcl_aw would mark every later visit as paid for 90 days.
function clickIdChannel(p: URLSearchParams): Channel | null {
  for (const param of GOOGLE_CLICK_IDS) {
    if (p.get(param)) return { s: 'google', m: 'cpc' };
  }
  if (p.get('msclkid')) return { s: 'bing', m: 'cpc' };
  return null;
}

// An empty referrer is not internal: a real ad click can arrive without one.
function isInternalReferrer(referrerHost: string, currentHost: string): boolean {
  if (!referrerHost) return false;
  return registrableDomain(referrerHost) === registrableDomain(currentHost);
}

export function classifyChannel(search: string, referrerHost: string, currentHost: string): Channel {
  const p = new URLSearchParams(search);

  const utm = utmChannel(p);
  if (utm) return utm;

  // A click ID behind an internal referrer was carried over, not clicked:
  // consent mode's url_passthrough appends it to every internal link once
  // ad_storage is denied.
  if (!isInternalReferrer(referrerHost, currentHost)) {
    const click = clickIdChannel(p);
    if (click) return click;
  }

  // Compared on domain level so a hop between subdomains stays internal.
  if (referrerHost && registrableDomain(referrerHost) !== registrableDomain(currentHost)) {
    const label = domainLabel(referrerHost);
    if (SEARCH_ENGINE_LABELS.indexOf(label) > -1) return { s: label, m: 'organic' };
    return { s: referrerHost, m: 'referral' };
  }

  return { s: 'direct', m: 'none' };
}

function hasCampaignSignal(search: string, referrerHost: string, currentHost: string): boolean {
  const p = new URLSearchParams(search);
  if (utmChannel(p)) return true;
  if (isInternalReferrer(referrerHost, currentHost)) return false;
  return !!clickIdChannel(p);
}

function sameChannel(a: Channel | undefined, b: Channel): boolean {
  if (!a) return false;
  const keys: Array<keyof Channel> = ['s', 'm', 'cm', 'ct', 'tm'];
  return keys.every((key) => (a[key] || '') === (b[key] || ''));
}

// Accepts both the compact format and the original one still living in cookies
// out in the field, so existing journeys survive the upgrade.
function toCompactEntry(entry: unknown): ChannelFlowEntry | null {
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as Record<string, any>;

  if (typeof e.t === 'number' && e.ch && typeof e.ch === 'object') {
    return e as ChannelFlowEntry;
  }
  if (typeof e.timestamp === 'number' && e.channel && typeof e.channel === 'object') {
    const legacy = e.channel as Record<string, string>;
    const channel: Channel = {} as Channel;
    if (legacy.source) channel.s = legacy.source;
    if (legacy.medium) channel.m = legacy.medium;
    if (legacy.campaign) channel.cm = legacy.campaign;
    if (legacy.content) channel.ct = legacy.content;
    if (legacy.term) channel.tm = legacy.term;
    return { t: e.timestamp, ch: channel };
  }
  return null;
}

// The GTM tag writes this cookie URL encoded; this one does the same so both
// can read each other's value instead of wiping the journey.
function parseCookie(raw: string | null): unknown[] | null {
  if (!raw) return null;
  let text = raw;
  if (text.charAt(0) !== '[') {
    try {
      text = decodeURIComponent(text);
    } catch {
      return null;
    }
  }
  if (text.charAt(0) !== '[') return null;
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function readChannelFlow(): ChannelFlowEntry[] {
  const parsed = parseCookie(getCookie(CHANNEL_FLOW_COOKIE));
  if (!parsed) return [];

  const flow: ChannelFlowEntry[] = [];
  for (const entry of parsed) {
    const compact = toCompactEntry(entry);
    if (compact) flow.push(compact);
  }
  return flow;
}

// Always drops the second entry, never the first: the first touch is what
// makes first-touch attribution possible.
function applyLimits(flow: ChannelFlowEntry[]): ChannelFlowEntry[] {
  while (flow.length > MAX_ENTRIES && flow.length > 1) flow.splice(1, 1);
  while (flow.length > 1 && encodeURIComponent(JSON.stringify(flow)).length > MAX_COOKIE_LENGTH) {
    flow.splice(1, 1);
  }
  return flow;
}

export function updateChannelFlow(
  search: string,
  referrerHost: string,
  currentHost: string,
  now: number,
  path = '',
): void {
  const flow = readChannelFlow();
  // Truthy, not just present: a cleared cookie can linger as an empty value.
  const sessionActive = !!getCookie(SESSION_COOKIE);

  const channel = classifyChannel(search, referrerHost, currentHost);
  const last = flow[flow.length - 1];

  const isNewSession =
    !last ||
    !sessionActive ||
    (hasCampaignSignal(search, referrerHost, currentHost) && !sameChannel(last.ch, channel));

  if (isNewSession) {
    const entry: ChannelFlowEntry = { t: now, ch: channel };
    if (path) entry.lp = path.length > 100 ? path.slice(0, 100) : path;
    flow.push(entry);
    applyLimits(flow);
  }

  setCookie(CHANNEL_FLOW_COOKIE, encodeURIComponent(JSON.stringify(flow)), MAX_AGE_SECONDS);
  // Its existence is the session signal; expiry is left to the browser.
  setCookie(SESSION_COOKIE, '1', SESSION_TIMEOUT_SECONDS);
}

export function updateChannelFlowFromPage(): void {
  let referrerHost = '';
  try {
    if (document.referrer) referrerHost = new URL(document.referrer).host;
  } catch {
    /* invalid referrer */
  }
  updateChannelFlow(location.search, referrerHost, location.host, Date.now(), location.pathname);
}
