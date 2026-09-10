import type { FormIcon } from './forms';

/**
 * Een infokaart: een bericht met één knop naar een pagina. Levert bewust geen
 * lead op — het is een doorverwijzing, geen contactmoment.
 */
export interface LinkDef {
  id: string;
  /** Knop in het kanaalpaneel, of chip in het gesprek. */
  title: string;
  sub: string;
  icon: FormIcon;
  /** Bericht in het gesprek; in de kanalenlijst ongebruikt. */
  message: string;
  button: { label: string; url: string };
}

export interface UserLinkDef {
  title?: string;
  sub?: string;
  icon?: FormIcon;
  message?: string;
  button?: { label?: string; url?: string };
}

export function normalizeLinks(user: Record<string, UserLinkDef> | undefined): Record<string, LinkDef> {
  const out: Record<string, LinkDef> = {};
  for (const id of Object.keys(user || {})) {
    const u = (user || {})[id] || {};
    const url = (u.button && u.button.url) || '';
    // Zonder doel valt er niets te openen; dan liever geen knop dan een dode knop.
    if (!url) continue;
    const title = u.title || id;
    out[id] = {
      id,
      title,
      sub: u.sub || '',
      icon: u.icon || 'info',
      message: u.message || '',
      button: { label: (u.button && u.button.label) || title, url },
    };
  }
  return out;
}
