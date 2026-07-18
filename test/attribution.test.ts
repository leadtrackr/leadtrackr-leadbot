import { beforeEach, describe, expect, it } from 'vitest';
import { collectAttribution } from '../src/attribution';

function clearCookies() {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = name + '=;max-age=0;path=/';
  }
}

describe('collectAttribution (GTM-tag parity)', () => {
  beforeEach(clearCookies);

  it('takes gclid and wbraid from the URL first', () => {
    const a = collectAttribution('?gclid=URLGCLID&wbraid=URLWBRAID', 'klant.nl', 1000);
    expect(a.gclid).toBe('URLGCLID');
    expect(a.wbraid).toBe('URLWBRAID');
  });

  it('falls back to _gcl_aw / _gcl_gb cookies (third dot-segment)', () => {
    document.cookie = '_gcl_aw=GCL.1719000000.COOKIEGCLID;path=/';
    document.cookie = '_gcl_gb=GCL.1719000000.COOKIEWBRAID;path=/';
    const a = collectAttribution('', 'klant.nl', 1000);
    expect(a.gclid).toBe('COOKIEGCLID');
    expect(a.wbraid).toBe('COOKIEWBRAID');
  });

  it('uses the _fbc cookie as-is when it matches the fbclid', () => {
    document.cookie = '_fbc=fb.1.111.MATCHING;path=/';
    const a = collectAttribution('?fbclid=MATCHING', 'klant.nl', 5000);
    expect(a.fbc).toBe('fb.1.111.MATCHING');
  });

  it('constructs fbc from fbclid when the cookie is missing or stale', () => {
    expect(collectAttribution('?fbclid=NEWID', 'www.klant.nl', 5000).fbc).toBe('fb.2.5000.NEWID');
    document.cookie = '_fbc=fb.1.111.OLDID;path=/';
    expect(collectAttribution('?fbclid=NEWID', 'klant.nl', 6000).fbc).toBe('fb.1.6000.NEWID');
  });

  it('parses the GA4 client id from the _ga cookie', () => {
    document.cookie = '_ga=GA1.1.1234567890.1719000000;path=/';
    expect(collectAttribution('', 'klant.nl', 1000).cid).toBe('1234567890.1719000000');
  });

  it('degrades to empty strings when nothing is present', () => {
    expect(collectAttribution('', 'klant.nl', 1000)).toEqual({
      fbc: '', fbp: '', gclid: '', wbraid: '', cid: '',
    });
  });

  it('passes _fbp through untouched', () => {
    document.cookie = '_fbp=fb.1.1719000000.987654321;path=/';
    expect(collectAttribution('', 'klant.nl', 1000).fbp).toBe('fb.1.1719000000.987654321');
  });
});
