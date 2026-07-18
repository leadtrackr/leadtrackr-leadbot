import { beforeEach, describe, expect, it } from 'vitest';
import {
  CHANNEL_FLOW_COOKIE,
  classifyChannel,
  readChannelFlow,
  updateChannelFlow,
} from '../src/channelflow';

function clearCookies() {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = name + '=;max-age=0;path=/';
  }
}

describe('classifyChannel (GTM-tag parity)', () => {
  it('returns full UTM object (all five keys) when any UTM is set', () => {
    expect(classifyChannel('?utm_source=google&utm_medium=cpc', '', 'klant.nl')).toEqual({
      source: 'google', medium: 'cpc', campaign: '', content: '', term: '',
    });
  });

  it('classifies known search engines as organic with bare domain as source', () => {
    expect(classifyChannel('', 'www.google.com', 'klant.nl')).toEqual({
      source: 'google', medium: 'organic',
    });
    expect(classifyChannel('', 'duckduckgo.com', 'klant.nl')).toEqual({
      source: 'duckduckgo', medium: 'organic',
    });
  });

  it('classifies an external referrer as referral with full host as source', () => {
    expect(classifyChannel('', 'blog.example.com', 'klant.nl')).toEqual({
      source: 'blog.example.com', medium: 'referral',
    });
  });

  it('classifies same-host referrer and empty referrer as direct/none', () => {
    expect(classifyChannel('', 'klant.nl', 'klant.nl')).toEqual({ source: 'direct', medium: 'none' });
    expect(classifyChannel('', '', 'klant.nl')).toEqual({ source: 'direct', medium: 'none' });
  });

  it('UTM wins over referrer', () => {
    expect(classifyChannel('?utm_source=nb&utm_medium=email', 'www.google.com', 'klant.nl').medium).toBe('email');
  });
});

describe('updateChannelFlow / readChannelFlow', () => {
  beforeEach(clearCookies);

  it('appends first entry and reads it back', () => {
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 1000);
    expect(readChannelFlow()).toEqual([
      { timestamp: 1000, channel: { source: 'google', medium: 'cpc', campaign: '', content: '', term: '' } },
    ]);
  });

  it('keeps last channel on a later pageview without new UTMs (no re-classification)', () => {
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 1000);
    updateChannelFlow('', 'www.google.com', 'klant.nl', 2000); // would be organic if reclassified
    const flow = readChannelFlow();
    expect(flow).toHaveLength(1);
    expect(flow[0].channel.medium).toBe('cpc');
  });

  it('appends a new entry when new UTM params differ', () => {
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 1000);
    updateChannelFlow('?utm_source=nieuwsbrief&utm_medium=email', '', 'klant.nl', 2000);
    const flow = readChannelFlow();
    expect(flow).toHaveLength(2);
    expect(flow[1]).toEqual({
      timestamp: 2000,
      channel: { source: 'nieuwsbrief', medium: 'email', campaign: '', content: '', term: '' },
    });
  });

  it('does not append a duplicate of the same channel', () => {
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 1000);
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 2000);
    expect(readChannelFlow()).toHaveLength(1);
  });

  it('recovers from a corrupt cookie', () => {
    document.cookie = CHANNEL_FLOW_COOKIE + '=[broken json;path=/';
    expect(readChannelFlow()).toEqual([]);
    updateChannelFlow('', '', 'klant.nl', 1000);
    expect(readChannelFlow()).toHaveLength(1);
  });
});
