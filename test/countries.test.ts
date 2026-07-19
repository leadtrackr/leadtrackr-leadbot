import { describe, expect, it } from 'vitest';
import { flagEmoji, getCountries } from '../src/countries';

describe('getCountries', () => {
  it('returns a full international list', () => {
    const list = getCountries('en');
    expect(list.length).toBeGreaterThan(200);
  });

  it('localizes names via Intl and includes dial + flag', () => {
    const nl = getCountries('nl');
    const germany = nl.find((c) => c.code === 'DE')!;
    expect(germany.name).toBe('Duitsland');
    expect(germany.dial).toBe('+49');
    expect(germany.flag).toBe('🇩🇪');
    const en = getCountries('en');
    expect(en.find((c) => c.code === 'DE')!.name).toBe('Germany');
  });

  it('sorts alphabetically by localized name', () => {
    const list = getCountries('en');
    const names = list.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('contains NL with +31', () => {
    const nl = getCountries('en').find((c) => c.code === 'NL')!;
    expect(nl.dial).toBe('+31');
  });
});

describe('flagEmoji', () => {
  it('builds regional-indicator flags from ISO codes', () => {
    expect(flagEmoji('NL')).toBe('🇳🇱');
    expect(flagEmoji('be')).toBe('🇧🇪');
  });
});
