import { beforeEach, describe, expect, it } from 'vitest';
import { getCookie, setCookie } from '../src/cookies';

function clearCookies() {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = name + '=;max-age=0;path=/';
  }
}

describe('cookies', () => {
  beforeEach(clearCookies);

  it('returns null for a missing cookie', () => {
    expect(getCookie('nope')).toBeNull();
  });

  it('reads back what it writes, raw (no URI encoding)', () => {
    const json = '[{"timestamp":1,"channel":{"source":"direct","medium":"none"}}]';
    setCookie('lt_channelflow', json, 3600);
    expect(getCookie('lt_channelflow')).toBe(json);
  });

  it('finds the right cookie among several', () => {
    setCookie('a', '1', 3600);
    setCookie('ab', '2', 3600);
    expect(getCookie('a')).toBe('1');
    expect(getCookie('ab')).toBe('2');
  });
});
