import type { UserConfig } from './config';
import type { UserFormDef, UserFormField, UserFormOption } from './forms';
import type { Language } from './i18n';

/**
 * Een site die meerdere talen serveert, hoeft niet zijn hele config te
 * herhalen: `byLanguage` legt per taal een laag over de basis heen, en de
 * LeadBot pakt de laag die hoort bij de taal die hij op de pagina detecteert.
 * Kanaal-id's blijven daardoor over talen heen gelijk, dus in de dataLayer en
 * in LeadTrackr blijft het één stroom.
 */

// Deze sleutels bevatten losse teksten of losse waarden; daar wil je per taal
// alleen de regels overschrijven die je vertaalt, niet het hele blok.
const MERGED_KEYS = ['texts', 'formNames', 'theme', 'offset'];

/**
 * Opties volgen dezelfde regel als velden: de basis bepaalt welke er zijn en in
 * welke volgorde, de taallaag levert alleen het vertaalde label. De `value`
 * blijft daardoor in elke taal gelijk, dus leads zijn over talen heen te
 * vergelijken.
 */
function mergeOptions(
  base: UserFormOption[] | undefined,
  overlay: UserFormOption[] | undefined,
): UserFormOption[] | undefined {
  if (!overlay) return base;
  if (!base) return overlay;
  const valueOf = (o: UserFormOption): string => (typeof o === 'string' ? o : o.value);
  const byValue = new Map(overlay.map((o) => [valueOf(o), o]));
  const merged = base.map((o) => {
    const value = valueOf(o);
    const translated = byValue.get(value);
    byValue.delete(value);
    if (!translated) return o;
    const label = typeof translated === 'string' ? translated : translated.label;
    return { value, label: label || value };
  });
  return [...merged, ...overlay.filter((o) => byValue.has(valueOf(o)))];
}

/**
 * Velden volgen de basis: die bepaalt welke velden er zijn, in welke volgorde
 * en met welk type. De taallaag hoeft alleen labels en placeholders te geven.
 * Een key die de basis niet heeft, komt erachteraan — zo kan een land een
 * extra veld vragen (bijv. een btw-nummer) zonder een tweede formulier.
 */
function mergeFields(
  base: UserFormField[] | undefined,
  overlay: UserFormField[] | undefined,
): UserFormField[] | undefined {
  if (!overlay) return base;
  if (!base) return overlay;
  const byKey = new Map(overlay.map((f) => [f.key, f]));
  const merged = base.map((f) => {
    const translated = byKey.get(f.key);
    byKey.delete(f.key);
    if (!translated) return f;
    const options = mergeOptions(f.options, translated.options);
    return { ...f, ...translated, ...(options ? { options } : {}) };
  });
  return [...merged, ...overlay.filter((f) => byKey.has(f.key))];
}

function mergeForms(
  base: Record<string, UserFormDef> | undefined,
  overlay: Record<string, UserFormDef>,
): Record<string, UserFormDef> {
  if (!base) return overlay;
  const out: Record<string, UserFormDef> = { ...base };
  for (const id of Object.keys(overlay)) {
    const translated = overlay[id];
    const original = base[id];
    out[id] = original
      ? { ...original, ...translated, fields: mergeFields(original.fields, translated.fields) }
      : translated;
  }
  return out;
}

export function applyLanguageOverlay(
  user: UserConfig | undefined,
  language: Language,
): UserConfig | undefined {
  if (!user || !user.byLanguage) return user;
  const { byLanguage, ...base } = user;
  const overlay = byLanguage[language] as Record<string, unknown> | undefined;
  const out = { ...base } as Record<string, unknown>;
  if (!overlay) return out as UserConfig;
  for (const key of Object.keys(overlay)) {
    const value = overlay[key];
    if (value === undefined) continue;
    if (key === 'forms') {
      out.forms = mergeForms(base.forms, value as Record<string, UserFormDef>);
    } else if (MERGED_KEYS.indexOf(key) !== -1) {
      out[key] = { ...((base as Record<string, unknown>)[key] as object), ...(value as object) };
    } else {
      out[key] = value;
    }
  }
  return out as UserConfig;
}
