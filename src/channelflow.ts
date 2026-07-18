import { getCookie, setCookie } from './cookies';
import type { Channel, ChannelFlowEntry } from './types';

export const CHANNEL_FLOW_COOKIE = 'lt_channelflow';
const MAX_AGE_SECONDS = 395 * 86400;
const ORGANIC_ENGINES = ['google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com'];
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

function domainFromHost(host: string): string {
  const parts = host.split('.');
  return parts.length >= 2 ? parts[parts.length - 2] : host;
}

export function classifyChannel(search: string, referrerHost: string, currentHost: string): Channel {
  const p = new URLSearchParams(search);
  const utm: Channel = {
    source: p.get('utm_source') || '',
    medium: p.get('utm_medium') || '',
    campaign: p.get('utm_campaign') || '',
    content: p.get('utm_content') || '',
    term: p.get('utm_term') || '',
  };
  if (utm.source || utm.medium || utm.campaign || utm.content || utm.term) return utm;
  if (referrerHost) {
    for (const engine of ORGANIC_ENGINES) {
      if (referrerHost.indexOf(engine) > -1) {
        return { source: domainFromHost(referrerHost) || '(not set)', medium: 'organic' };
      }
    }
    if (currentHost && referrerHost !== currentHost) {
      return { source: referrerHost || '(not set)', medium: 'referral' };
    }
  }
  return { source: 'direct', medium: 'none' };
}

export function readChannelFlow(): ChannelFlowEntry[] {
  const raw = getCookie(CHANNEL_FLOW_COOKIE);
  if (!raw || raw.charAt(0) !== '[') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function updateChannelFlow(search: string, referrerHost: string, currentHost: string, now: number): void {
  const flow = readChannelFlow();
  const p = new URLSearchParams(search);
  const hasNewUtm = UTM_KEYS.some((k) => p.get(k));
  const last = flow[flow.length - 1];
  const channel = last && !hasNewUtm ? last.channel : classifyChannel(search, referrerHost, currentHost);
  if (!last || JSON.stringify(last.channel) !== JSON.stringify(channel)) {
    flow.push({ timestamp: now, channel });
  }
  setCookie(CHANNEL_FLOW_COOKIE, JSON.stringify(flow), MAX_AGE_SECONDS);
}

export function updateChannelFlowFromPage(): void {
  let referrerHost = '';
  try {
    if (document.referrer) referrerHost = new URL(document.referrer).host;
  } catch {
    /* invalid referrer */
  }
  updateChannelFlow(location.search, referrerHost, location.host, Date.now());
}
