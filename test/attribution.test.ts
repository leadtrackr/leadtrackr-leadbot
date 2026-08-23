import { beforeEach, describe, expect, it } from 'vitest';
import { collectAttribution } from '../src/attribution';
import { emptyAttribution } from './attribution-fixture';

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
    expect(collectAttribution('', 'klant.nl', 1000)).toEqual(emptyAttribution());
  });

  it('carries the conversion page through', () => {
    expect(collectAttribution('', 'klant.nl', 1000, 'www.klant.nl/bedankt').conversionPage).toBe(
      'www.klant.nl/bedankt',
    );
  });

  it('leaves consent off entirely when it cannot be determined', () => {
    expect(collectAttribution('', 'klant.nl', 1000)).not.toHaveProperty('consent');
  });

  it('includes consent when it is known', () => {
    expect(collectAttribution('', 'klant.nl', 1000, '', { ad_storage: 'denied' }).consent).toEqual({
      ad_storage: 'denied',
    });
  });

  it('passes _fbp through untouched', () => {
    document.cookie = '_fbp=fb.1.1719000000.987654321;path=/';
    expect(collectAttribution('', 'klant.nl', 1000).fbp).toBe('fb.1.1719000000.987654321');
  });
});

describe('collectAttribution — ad click IDs per channel', () => {
  beforeEach(clearCookies);

  it('takes each channel click ID from the URL before the cookie', () => {
    document.cookie = 'ttclid=COOKIE;path=/';
    document.cookie = '_epik=COOKIE;path=/';
    const a = collectAttribution(
      '?ttclid=URLTT&epik=URLEPIK&twclid=URLTW&rdt_cid=URLRDT&li_fat_id=URLLI&oppref=URLOAI',
      'klant.nl',
      1000,
    );
    expect(a.ttclid).toBe('URLTT');
    expect(a.epik).toBe('URLEPIK');
    expect(a.twclid).toBe('URLTW');
    expect(a.rdt_cid).toBe('URLRDT');
    expect(a.li_fat_id).toBe('URLLI');
    expect(a.oppref).toBe('URLOAI');
  });

  it("matches Snapchat's ScCid exactly, not a lowercased form", () => {
    expect(collectAttribution('?ScCid=SNAP', 'klant.nl', 1000).scclid).toBe('SNAP');
    expect(collectAttribution('?sccid=SNAP', 'klant.nl', 1000).scclid).toBe('');
  });

  it('falls back to the cookie each platform pixel writes', () => {
    document.cookie = 'ttclid=TT;path=/';
    document.cookie = '_ttp=TTP;path=/';
    document.cookie = '_scclid=SC;path=/';
    document.cookie = '_scid=SCID;path=/';
    document.cookie = '_epik=EPIK;path=/';
    document.cookie = 'twclid=TW;path=/';
    document.cookie = '_rdt_cid=RDT;path=/';
    document.cookie = '_rdt_uuid=1684189007728.uuid;path=/';
    document.cookie = 'li_fat_id=LI;path=/';
    document.cookie = '__oppref=OAI;path=/';
    document.cookie = '__obref=OBREF;path=/';
    const a = collectAttribution('', 'klant.nl', 1000);
    expect(a).toMatchObject({
      ttclid: 'TT', ttp: 'TTP', scclid: 'SC', scid: 'SCID', epik: 'EPIK',
      twclid: 'TW', rdt_cid: 'RDT', rdt_uuid: '1684189007728.uuid',
      li_fat_id: 'LI', oppref: 'OAI', obref: 'OBREF',
    });
  });

  it("falls back to Reddit's older rdt_cid cookie", () => {
    document.cookie = 'rdt_cid=OLD;path=/';
    expect(collectAttribution('', 'klant.nl', 1000).rdt_cid).toBe('OLD');
    document.cookie = '_rdt_cid=NEW;path=/';
    expect(collectAttribution('', 'klant.nl', 1000).rdt_cid).toBe('NEW');
  });

  it("strips the _uet prefix UET writes into its own cookie value", () => {
    document.cookie = '_uetmsclkid=_uet561f11b5eb0d;path=/';
    expect(collectAttribution('', 'klant.nl', 1000).msclkid).toBe('561f11b5eb0d');
  });

  it('prefers msclkid from the URL over the cookie', () => {
    document.cookie = '_uetmsclkid=_uetPIXEL;path=/';
    expect(collectAttribution('', 'klant.nl', 1000).msclkid).toBe('PIXEL');
    expect(collectAttribution('?msclkid=URL', 'klant.nl', 1000).msclkid).toBe('URL');
  });

  it('reads gbraid from _gcl_ag, which uses the server-side format', () => {
    document.cookie = '_gcl_ag=GCL.1719000000.kGBRAIDVALUE$i;path=/';
    expect(collectAttribution('', 'klant.nl', 1000).gbraid).toBe('GBRAIDVALUE');
  });

  it('ignores the server-side FPGCL* cookies, which are HttpOnly here', () => {
    document.cookie = 'FPGCLAW=GCL.1719000000.kSERVERGCLID$i;path=/';
    expect(collectAttribution('', 'klant.nl', 1000).gclid).toBe('');
  });

  it('reads dclid from the browser tag cookie', () => {
    document.cookie = '_gcl_dc=GCL.1719000000.DCLIDVALUE;path=/';
    expect(collectAttribution('', 'klant.nl', 1000).dclid).toBe('DCLIDVALUE');
  });

  it('leaves every channel empty when nothing is present', () => {
    const a = collectAttribution('', 'klant.nl', 1000);
    expect(a.ttclid).toBe('');
    expect(a.scclid).toBe('');
    expect(a.msclkid).toBe('');
    expect(a.gbraid).toBe('');
  });
});
