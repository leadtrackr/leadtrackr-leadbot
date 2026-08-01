export interface WaLinkTarget {
  /** Alleen cijfers, zonder + of leidende nullen; '' als de link geen nummer bevat. */
  phone: string;
  text: string;
}

const digits = (v: string | null): string => (v || '').replace(/\D/g, '');

// Herkent de standaard WhatsApp-linkvormen: wa.me/<nummer>,
// api.whatsapp.com/send?phone=, web.whatsapp.com/send?phone= en
// whatsapp://send?phone=. Groeps- en shortcode-links (chat.whatsapp.com,
// wa.me/message/…) blijven met opzet ongemoeid — die kunnen we niet nabouwen.
export function parseWaLink(href: string): WaLinkTarget | null {
  let url: URL;
  try {
    url = new URL(href, location.href);
  } catch {
    return null;
  }
  if (url.protocol === 'whatsapp:') {
    if (!/(^|\/)send\/?$/.test(url.hostname + url.pathname)) return null;
    return { phone: digits(url.searchParams.get('phone')), text: url.searchParams.get('text') || '' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host === 'wa.me') {
    const path = url.pathname.replace(/\//g, '');
    if (path && !/^\+?\d+$/.test(path)) return null;
    return { phone: digits(path), text: url.searchParams.get('text') || '' };
  }
  if (host === 'api.whatsapp.com' || host === 'web.whatsapp.com') {
    if (!/^\/send\/?$/.test(url.pathname)) return null;
    return { phone: digits(url.searchParams.get('phone')), text: url.searchParams.get('text') || '' };
  }
  return null;
}
