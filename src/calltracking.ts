// Integration with LeadTrackr call tracking (dynamic number insertion).
// The call-tracking script stores its swap numbers in a cookie named
// <prefix><accountId>_<timestamp>; the LeadBot reads the number from that
// cookie so the tracked number also shows inside the Shadow DOM.

export interface DynamicNumber {
  link: string; // digits for the tel: link, e.g. "31853016935"
  display: string; // formatted number, e.g. "+31 085 3016935"
}

interface SwapEntry {
  swapNumbers?: { link?: string; display?: string };
  swapGroup?: number;
}

function parseValue(raw: string): { swap_numbers?: string; expires_on?: number } | null {
  for (const candidate of [raw, (() => { try { return decodeURIComponent(raw); } catch { return raw; } })()]) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* try next */
    }
  }
  return null;
}

export function getDynamicNumber(prefix: string, swapGroup: number): DynamicNumber | null {
  const matches: { name: string; value: string }[] = [];
  for (const part of document.cookie.split('; ')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq);
    if (name.indexOf(prefix) === 0) matches.push({ name, value: part.slice(eq + 1) });
  }
  // Cookie names end in a timestamp — newest first.
  matches.sort((a, b) => (a.name < b.name ? 1 : -1));
  for (const { value } of matches) {
    const parsed = parseValue(value);
    if (!parsed || !parsed.swap_numbers) continue;
    if (parsed.expires_on && parsed.expires_on < Date.now()) continue;
    let entries: SwapEntry[];
    try {
      entries = JSON.parse(parsed.swap_numbers);
    } catch {
      continue;
    }
    if (!Array.isArray(entries) || !entries.length) continue;
    const entry = entries.find((e) => e.swapGroup === swapGroup) || entries[0];
    const link = entry.swapNumbers?.link;
    const display = entry.swapNumbers?.display;
    if (link && display) return { link, display };
  }
  return null;
}
