import { describe, expect, it } from 'vitest';
import { brandFooter, brandUrl } from '../src/ui/views';
import { resolveConfig } from '../src/config';

describe('brandUrl', () => {
  it('tags the link with the site it runs on', () => {
    const url = new URL(brandUrl('diksprocesssupport.nl'));
    expect(url.origin + url.pathname).toBe('https://leadtrackr.io/');
    expect(url.searchParams.get('utm_source')).toBe('leadbot');
    expect(url.searchParams.get('utm_medium')).toBe('referral');
    expect(url.searchParams.get('utm_campaign')).toBe('diksprocesssupport.nl');
  });

  it('drops the www so one site is one campaign', () => {
    expect(new URL(brandUrl('www.diksprocesssupport.nl')).searchParams.get('utm_campaign')).toBe(
      'diksprocesssupport.nl',
    );
  });

  it('falls back when there is no host', () => {
    expect(new URL(brandUrl('')).searchParams.get('utm_campaign')).toBe('(not set)');
  });
});

describe('brandFooter', () => {
  it('renders the tagged link, HTML-escaped', () => {
    const html = brandFooter(resolveConfig('proj-1', {}));
    expect(html).toContain('utm_source=leadbot');
    expect(html).toContain('&amp;utm_medium=referral');
    expect(html).not.toContain('href="https://leadtrackr.io"');
  });

  it('stays empty when branding is off', () => {
    expect(brandFooter(resolveConfig('proj-1', { branding: false }))).toBe('');
  });
});
