let cachedDomain: string | null | undefined;

export function getCookie(name: string): string | null {
  const prefix = name + '=';
  for (const part of document.cookie.split('; ')) {
    if (part.indexOf(prefix) === 0) return part.slice(prefix.length);
  }
  return null;
}

// GTM's domain:'auto' — highest domain a cookie sticks on, so subdomains share it.
function cookieDomain(): string | null {
  if (cachedDomain !== undefined) return cachedDomain;
  const parts = location.hostname.split('.');
  for (let i = parts.length - 2; i >= 0; i--) {
    const candidate = parts.slice(i).join('.');
    document.cookie = 'ltw_probe=1;path=/;domain=' + candidate;
    if (getCookie('ltw_probe')) {
      document.cookie = 'ltw_probe=;path=/;domain=' + candidate + ';max-age=0';
      cachedDomain = candidate;
      return candidate;
    }
  }
  cachedDomain = null;
  return null;
}

export function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  const domain = cookieDomain();
  document.cookie =
    name + '=' + value + ';path=/;max-age=' + maxAgeSeconds +
    (domain ? ';domain=' + domain : '') +
    (location.protocol === 'https:' ? ';secure' : '');
}
