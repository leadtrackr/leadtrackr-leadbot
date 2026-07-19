import { beforeEach, describe, expect, it } from 'vitest';
import { getDynamicNumber } from '../src/calltracking';

const VALUE = JSON.stringify({
  swap_numbers: JSON.stringify([
    { swapNumbers: { link: '31853016935', display: '+31 085 3016935' }, swapGroup: 0 },
    { swapNumbers: { link: '31201234567', display: '+31 020 1234567' }, swapGroup: 1 },
  ]),
  orig_source_type: 'referrer_internal',
  guid: 'd85396f2-3430-45a8-88cc-72cf85f04377',
  expires_on: Date.now() + 86400000,
});

function clearCookies() {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = name + '=;max-age=0;path=/';
  }
}

describe('getDynamicNumber', () => {
  beforeEach(clearCookies);

  it('reads the swap number from a yeswetrack_* cookie regardless of the suffix', () => {
    document.cookie = 'yeswetrack_9079013837_20250530075820=' + encodeURIComponent(VALUE) + ';path=/';
    expect(getDynamicNumber('yeswetrack_', 0)).toEqual({
      link: '31853016935',
      display: '+31 085 3016935',
    });
  });

  it('works with a different client cookie name and picks the requested swapGroup', () => {
    document.cookie = 'yeswetrack_9079031374_20250826014545=' + encodeURIComponent(VALUE) + ';path=/';
    expect(getDynamicNumber('yeswetrack_', 1)).toEqual({
      link: '31201234567',
      display: '+31 020 1234567',
    });
  });

  it('accepts raw (non URL-encoded) cookie values too', () => {
    document.cookie = 'yeswetrack_1_20250101000000=' + VALUE.replace(/;/g, '') + ';path=/';
    // raw JSON without semicolons parses directly
    const result = getDynamicNumber('yeswetrack_', 0);
    expect(result?.link).toBe('31853016935');
  });

  it('prefers the newest cookie when multiple match', () => {
    const older = JSON.stringify({
      swap_numbers: JSON.stringify([{ swapNumbers: { link: '31000000000', display: 'OUD' }, swapGroup: 0 }]),
      expires_on: Date.now() + 86400000,
    });
    document.cookie = 'yeswetrack_1_20240101000000=' + encodeURIComponent(older) + ';path=/';
    document.cookie = 'yeswetrack_1_20250530075820=' + encodeURIComponent(VALUE) + ';path=/';
    expect(getDynamicNumber('yeswetrack_', 0)?.display).toBe('+31 085 3016935');
  });

  it('skips expired entries and falls back to null', () => {
    const expired = JSON.stringify({
      swap_numbers: JSON.stringify([{ swapNumbers: { link: '31000000000', display: 'OUD' }, swapGroup: 0 }]),
      expires_on: Date.now() - 1000,
    });
    document.cookie = 'yeswetrack_1_20240101000000=' + encodeURIComponent(expired) + ';path=/';
    expect(getDynamicNumber('yeswetrack_', 0)).toBeNull();
  });

  it('returns null when no cookie matches or JSON is invalid', () => {
    expect(getDynamicNumber('yeswetrack_', 0)).toBeNull();
    document.cookie = 'yeswetrack_1_20250101000000=kapot;path=/';
    expect(getDynamicNumber('yeswetrack_', 0)).toBeNull();
  });

  it('falls back to the first group when the requested swapGroup is missing', () => {
    document.cookie = 'yeswetrack_1_20250101000000=' + encodeURIComponent(VALUE) + ';path=/';
    expect(getDynamicNumber('yeswetrack_', 9)?.link).toBe('31853016935');
  });
});
