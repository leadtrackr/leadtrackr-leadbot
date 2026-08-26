import type { LeadBotTexts } from './i18n';

/**
 * Formulieren zijn configureerbaar vanaf de klantsite (in de praktijk: een
 * GTM Custom HTML-tag). Elk formulier is een eigen kanaal met een eigen id,
 * dus het paneel kan meerdere ingangen naast elkaar tonen — bijvoorbeeld een
 * terugbelverzoek naast een e-mailaanvraag.
 */

export type FieldType = 'text' | 'email' | 'tel' | 'textarea';
const FIELD_TYPES: FieldType[] = ['text', 'email', 'tel', 'textarea'];

export type FormIcon = 'chat' | 'phone' | 'mail' | 'whatsapp';
const FORM_ICONS: FormIcon[] = ['chat', 'phone', 'mail', 'whatsapp'];

/**
 * Keys met een vaste betekenis. Die gaan naar userData (LeadTrackr) en
 * user_data (Enhanced Conversions); elke andere key gaat als vrij veld mee in
 * formFields. Zo hoeft de config nergens een mapping te herhalen.
 */
export const RESERVED_KEYS = ['name', 'email', 'phone', 'message'] as const;
export type ReservedKey = (typeof RESERVED_KEYS)[number];

export function isReservedKey(key: string): key is ReservedKey {
  return (RESERVED_KEYS as readonly string[]).includes(key);
}

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder: string;
}

export interface FormDef {
  id: string;
  /** Titel en subtitel van de knop in het kanaalpaneel. */
  title: string;
  sub: string;
  icon: FormIcon;
  /** Kop boven het formulier zelf. */
  formTitle: string;
  /** formData.formName in de createLead-payload. */
  formName: string;
  submit: string;
  successTitle: string;
  successBody: string;
  fields: FormField[];
}

export interface UserFormField {
  key: string;
  label?: string;
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
}

export type UserFormDef = Partial<Omit<FormDef, 'id' | 'fields'>> & { fields?: UserFormField[] };

/** Standaardlabels voor de gereserveerde keys, zodat `{ key: 'name' }` genoeg is. */
function reservedDefaults(key: ReservedKey, t: LeadBotTexts): Omit<FormField, 'key' | 'required'> {
  if (key === 'email') return { label: t.emailLabel, type: 'email', placeholder: t.emailPlaceholder };
  if (key === 'phone') return { label: t.phoneLabel, type: 'tel', placeholder: t.phonePlaceholder };
  if (key === 'message') return { label: t.messageLabel, type: 'textarea', placeholder: t.messagePlaceholder };
  return { label: t.nameLabel, type: 'text', placeholder: t.namePlaceholder };
}

// Alleen eenvoudige keys: ze worden gebruikt als HTML-name, als selector en
// als veldnaam in LeadTrackr, dus alles wat daar kan bijten valt af.
const VALID_KEY = /^[A-Za-z0-9_-]+$/;

function normalizeField(u: UserFormField, t: LeadBotTexts): FormField | null {
  const key = (u.key || '').trim();
  if (!VALID_KEY.test(key)) return null;
  const base = isReservedKey(key)
    ? reservedDefaults(key, t)
    : { label: key, type: 'text' as FieldType, placeholder: '' };
  const type = u.type && FIELD_TYPES.includes(u.type) ? u.type : base.type;
  return {
    key,
    label: u.label || base.label,
    type,
    required: u.required === true,
    placeholder: u.placeholder !== undefined ? u.placeholder : base.placeholder,
  };
}

/** Het ingebouwde contactformulier: naam, e-mailadres, bericht — alle drie verplicht. */
export function builtinContactForm(t: LeadBotTexts, formName: string): FormDef {
  return {
    id: 'contact_form',
    title: t.msgTitle,
    sub: t.msgSub,
    icon: 'chat',
    formTitle: t.formTitle,
    formName,
    submit: t.submit,
    successTitle: t.successTitle,
    successBody: t.successBody,
    fields: (['name', 'email', 'message'] as ReservedKey[]).map((key) => ({
      key,
      required: true,
      ...reservedDefaults(key, t),
    })),
  };
}

function normalizeForm(id: string, u: UserFormDef, t: LeadBotTexts, base: FormDef | null): FormDef | null {
  const fields = u.fields
    ? u.fields.map((f) => normalizeField(f, t)).filter((f): f is FormField => f !== null)
    : base?.fields;
  // Een formulier zonder bruikbaar veld kan niets opleveren; dan liever geen
  // knop dan een lege view.
  if (!fields || !fields.length) return null;
  const title = u.title || base?.title || t.msgTitle;
  return {
    id,
    title,
    sub: u.sub !== undefined ? u.sub : base?.sub || t.msgSub,
    icon: u.icon && FORM_ICONS.includes(u.icon) ? u.icon : base?.icon || 'chat',
    formTitle: u.formTitle || base?.formTitle || title,
    formName: u.formName || base?.formName || 'LeadBot — ' + title,
    submit: u.submit || base?.submit || t.submit,
    successTitle: u.successTitle || base?.successTitle || t.successTitle,
    successBody: u.successBody || base?.successBody || t.successBody,
    fields,
  };
}

/**
 * Voegt de geconfigureerde formulieren samen met het ingebouwde
 * contactformulier. Zonder `forms` in de config verandert er niets: dan is
 * `contact_form` precies het formulier dat de LeadBot altijd al had.
 */
export function normalizeForms(
  user: Record<string, UserFormDef> | undefined,
  t: LeadBotTexts,
  contactFormName: string,
): Record<string, FormDef> {
  const builtin = builtinContactForm(t, contactFormName);
  const out: Record<string, FormDef> = { contact_form: builtin };
  for (const id of Object.keys(user || {})) {
    const def = normalizeForm(id, (user || {})[id] || {}, t, id === 'contact_form' ? builtin : null);
    if (def) out[id] = def;
    else if (id === 'contact_form') out.contact_form = builtin;
  }
  return out;
}
