import { getCookie } from './cookies';
import type { AttributionData } from './types';

// GTM parity: parts.length-1 for subdomains, else 1.
function subDomainIndex(hostname: string): number {
  const parts = hostname.split('.');
  return parts.length > 2 ? parts.length - 1 : 1;
}

export function collectAttribution(search: string, hostname: string, now: number): AttributionData {
  const p = new URLSearchParams(search);

  let gclid = p.get('gclid') || '';
  if (!gclid) {
    const c = getCookie('_gcl_aw');
    gclid = c ? c.split('.')[2] || '' : '';
  }

  let wbraid = p.get('wbraid') || '';
  if (!wbraid) {
    const c = getCookie('_gcl_gb');
    wbraid = c ? c.split('.')[2] || '' : '';
  }

  let fbc = getCookie('_fbc') || '';
  const fbclid = p.get('fbclid');
  if (fbclid) {
    const current = fbc.split('.').pop();
    if (!fbc || current !== fbclid) {
      fbc = 'fb.' + subDomainIndex(hostname) + '.' + now + '.' + encodeURIComponent(fbclid);
    }
  }

  const fbp = getCookie('_fbp') || '';

  let cid = '';
  const ga = getCookie('_ga');
  if (ga) {
    const parts = ga.split('.');
    if (parts.length >= 4) cid = parts[2] + '.' + parts[3];
  }

  return { fbc, fbp, gclid, wbraid, cid };
}

export function collectAttributionFromPage(): AttributionData {
  return collectAttribution(location.search, location.hostname, Date.now());
}
