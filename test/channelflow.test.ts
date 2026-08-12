import { beforeEach, describe, expect, it } from 'vitest';
import {
  CHANNEL_FLOW_COOKIE,
  SESSION_COOKIE,
  classifyChannel,
  readChannelFlow,
  registrableDomain,
  updateChannelFlow,
} from '../src/channelflow';

function clearCookies() {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = name + '=;max-age=0;path=/';
  }
}

/** The session cookie expiring is what a timeout looks like to the code. */
function expireSession() {
  document.cookie = SESSION_COOKIE + '=;max-age=0;path=/';
}

const summarise = () => readChannelFlow().map((e) => e.ch.s + '/' + e.ch.m + (e.lp ? ' ' + e.lp : ''));

describe('registrableDomain', () => {
  it('keeps two labels for a normal domain', () => {
    expect(registrableDomain('www.google.nl')).toBe('google.nl');
    expect(registrableDomain('klant.nl')).toBe('klant.nl');
  });

  it('keeps three labels behind a second-level suffix', () => {
    expect(registrableDomain('www.google.co.uk')).toBe('google.co.uk');
  });
});

describe('classifyChannel (GTM-tag parity)', () => {
  it('omits empty UTM keys instead of writing empty strings', () => {
    expect(classifyChannel('?utm_source=google&utm_medium=cpc', '', 'klant.nl')).toEqual({
      s: 'google', m: 'cpc',
    });
  });

  it('fills in (not set) when only part of the UTMs are present', () => {
    expect(classifyChannel('?utm_campaign=zomer', '', 'klant.nl')).toEqual({
      s: '(not set)', m: '(not set)', cm: 'zomer',
    });
  });

  it('classifies country domains of search engines as organic', () => {
    expect(classifyChannel('', 'www.google.nl', 'klant.nl')).toEqual({ s: 'google', m: 'organic' });
    expect(classifyChannel('', 'www.google.co.uk', 'klant.nl')).toEqual({ s: 'google', m: 'organic' });
    expect(classifyChannel('', 'duckduckgo.com', 'klant.nl')).toEqual({ s: 'duckduckgo', m: 'organic' });
  });

  it('classifies an external referrer as referral with full host as source', () => {
    expect(classifyChannel('', 'blog.example.com', 'klant.nl')).toEqual({
      s: 'blog.example.com', m: 'referral',
    });
  });

  it('treats a hop between subdomains as internal, not referral', () => {
    expect(classifyChannel('', 'www.klant.nl', 'shop.klant.nl')).toEqual({ s: 'direct', m: 'none' });
  });

  it('classifies same-host and empty referrer as direct/none', () => {
    expect(classifyChannel('', 'klant.nl', 'klant.nl')).toEqual({ s: 'direct', m: 'none' });
    expect(classifyChannel('', '', 'klant.nl')).toEqual({ s: 'direct', m: 'none' });
  });

  it('UTM wins over referrer', () => {
    expect(classifyChannel('?utm_source=nb&utm_medium=email', 'www.google.com', 'klant.nl').m).toBe('email');
  });

  describe('click ID fallback', () => {
    it('resolves gclid, gbraid and wbraid to google/cpc', () => {
      for (const param of ['gclid', 'gbraid', 'wbraid']) {
        expect(classifyChannel('?' + param + '=ABC', 'www.google.com', 'klant.nl')).toEqual({
          s: 'google', m: 'cpc',
        });
      }
    });

    it('resolves msclkid to bing/cpc', () => {
      expect(classifyChannel('?msclkid=ABC', '', 'klant.nl')).toEqual({ s: 'bing', m: 'cpc' });
    });

    it('ignores a click ID behind an internal referrer (url_passthrough)', () => {
      expect(classifyChannel('?gclid=ABC', 'www.klant.nl', 'www.klant.nl')).toEqual({
        s: 'direct', m: 'none',
      });
    });

    it('does not treat fbclid as paid', () => {
      expect(classifyChannel('?fbclid=XYZ', 'www.facebook.com', 'klant.nl')).toEqual({
        s: 'www.facebook.com', m: 'referral',
      });
    });
  });
});

describe('sessions', () => {
  beforeEach(clearCookies);

  it('records a separate entry per visit, also when the channel is identical', () => {
    updateChannelFlow('', '', 'klant.nl', 1000, '/');
    expireSession();
    updateChannelFlow('', '', 'klant.nl', 2000, '/prijzen');
    expireSession();
    updateChannelFlow('', '', 'klant.nl', 3000, '/contact');
    expect(summarise()).toEqual(['direct/none /', 'direct/none /prijzen', 'direct/none /contact']);
  });

  it('records a direct return after a paid visit instead of inheriting cpc', () => {
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 1000, '/tracking');
    expireSession();
    updateChannelFlow('', '', 'klant.nl', 2000, '/prijzen');
    expect(summarise()).toEqual(['google/cpc /tracking', 'direct/none /prijzen']);
  });

  it('does not append while the session is still active', () => {
    updateChannelFlow('', '', 'klant.nl', 1000, '/');
    updateChannelFlow('', 'www.klant.nl', 'klant.nl', 2000, '/prijzen');
    expect(readChannelFlow()).toHaveLength(1);
  });

  it('does not append on a refresh with the same UTMs', () => {
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 1000, '/lp');
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 2000, '/lp');
    expect(readChannelFlow()).toHaveLength(1);
  });

  it('appends when the campaign changes mid-session', () => {
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 1000, '/a');
    updateChannelFlow('?utm_source=nieuwsbrief&utm_medium=email', '', 'klant.nl', 2000, '/b');
    expect(summarise()).toEqual(['google/cpc /a', 'nieuwsbrief/email /b']);
  });

  it('does not let a carried-over click ID create paid entries across sessions', () => {
    updateChannelFlow('?gclid=ABC', 'www.google.com', 'klant.nl', 1000, '/lp');
    expireSession();
    updateChannelFlow('?gclid=ABC', 'www.klant.nl', 'klant.nl', 2000, '/prijzen');
    expect(summarise()).toEqual(['google/cpc /lp', 'direct/none /prijzen']);
  });

  it('still records a real ad click after a session timeout', () => {
    updateChannelFlow('', '', 'klant.nl', 1000, '/');
    expireSession();
    updateChannelFlow('?gclid=ABC', 'www.google.com', 'klant.nl', 2000, '/lp');
    expect(summarise()).toEqual(['direct/none /', 'google/cpc /lp']);
  });

  it('truncates a long landing path', () => {
    updateChannelFlow('', '', 'klant.nl', 1000, '/' + 'a'.repeat(200));
    expect(readChannelFlow()[0].lp).toHaveLength(100);
  });
});

describe('cookie handling', () => {
  beforeEach(clearCookies);

  it('reads back a cookie written URL encoded, as the GTM tag writes it', () => {
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 1000, '/lp');
    const raw = document.cookie
      .split('; ')
      .find((p) => p.indexOf(CHANNEL_FLOW_COOKIE + '=') === 0)!
      .slice(CHANNEL_FLOW_COOKIE.length + 1);
    expect(raw.charAt(0)).toBe('%');
    expect(readChannelFlow()).toEqual([{ t: 1000, ch: { s: 'google', m: 'cpc' }, lp: '/lp' }]);
  });

  it('migrates the original format without losing anything', () => {
    const legacy = JSON.stringify([
      { timestamp: 900, channel: { source: 'google', medium: 'cpc', campaign: 'oud', content: '', term: '' } },
    ]);
    document.cookie = CHANNEL_FLOW_COOKIE + '=' + legacy + ';path=/';
    expireSession();
    updateChannelFlow('', '', 'klant.nl', 1000, '/nieuw');
    expect(readChannelFlow()).toEqual([
      { t: 900, ch: { s: 'google', m: 'cpc', cm: 'oud' } },
      { t: 1000, ch: { s: 'direct', m: 'none' }, lp: '/nieuw' },
    ]);
  });

  it('recovers from a corrupt cookie', () => {
    document.cookie = CHANNEL_FLOW_COOKIE + '=[broken json;path=/';
    expect(readChannelFlow()).toEqual([]);
    updateChannelFlow('', '', 'klant.nl', 1000, '/');
    expect(readChannelFlow()).toHaveLength(1);
  });

  it('caps at 25 entries and keeps the first touch', () => {
    updateChannelFlow('?utm_source=eerste&utm_medium=cpc', '', 'klant.nl', 1, '/eerste');
    for (let i = 2; i <= 40; i++) {
      expireSession();
      updateChannelFlow('', '', 'klant.nl', i, '/p' + i);
    }
    const flow = readChannelFlow();
    expect(flow.length).toBeLessThanOrEqual(25);
    expect(flow[0].ch.s).toBe('eerste');
    expect(flow[flow.length - 1].lp).toBe('/p40');
  });

  it('keeps the stored cookie under the length guard with long campaign names', () => {
    for (let i = 0; i < 40; i++) {
      expireSession();
      updateChannelFlow(
        '?utm_source=google&utm_medium=cpc&utm_campaign=zomeractie-nederland-breed-2026-' + i +
          '&utm_content=advertentie-variant-' + i + '&utm_term=conversie+tracking+software',
        '', 'klant.nl', i, '/landingspagina-met-een-vrij-lang-pad-' + i,
      );
    }
    const raw = document.cookie
      .split('; ')
      .find((p) => p.indexOf(CHANNEL_FLOW_COOKIE + '=') === 0)!
      .slice(CHANNEL_FLOW_COOKIE.length + 1);
    expect(raw.length).toBeLessThanOrEqual(3500);
    expect(readChannelFlow().length).toBeGreaterThan(1);
  });
});
