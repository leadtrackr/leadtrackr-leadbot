import type { LeadBotConfig } from './config';
import type { FaqDef } from './faq';
import type { FormDef } from './forms';
import type { LinkDef } from './links';

export type ResolvedChannel =
  | { kind: 'form'; def: FormDef }
  | { kind: 'link'; def: LinkDef }
  | { kind: 'faq'; def: FaqDef }
  | { kind: 'phone' }
  | { kind: 'whatsapp' };

/**
 * De enige plek die weet wat een kanaal-id betekent. `phone` en `whatsapp` zijn
 * gereserveerd; elk ander id komt uit een van de kanaalmaps in de config. Zo
 * hoeven de views en de router niet zelf drie maps af te zoeken.
 */
export function resolveChannel(cfg: LeadBotConfig, id: string): ResolvedChannel | null {
  if (id === 'phone') return { kind: 'phone' };
  if (id === 'whatsapp') return { kind: 'whatsapp' };
  if (cfg.forms[id]) return { kind: 'form', def: cfg.forms[id] };
  if (cfg.links[id]) return { kind: 'link', def: cfg.links[id] };
  if (cfg.faqs[id]) return { kind: 'faq', def: cfg.faqs[id] };
  return null;
}
