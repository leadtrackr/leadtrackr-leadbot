import type { ChannelId } from './types';

export interface WidgetTheme {
  primary: string;
  primaryHover: string;
  primaryTint: string;
  launcherBorder: string;
  headerBg: string;
  headerText: string;
  panelBg: string;
  text: string;
  textMuted: string;
  border: string;
  error: string;
  radius: number;
}

export interface WidgetTexts {
  from: string;
  online: string;
  launcherLabel: string;
  close: string;
  back: string;
  msgTitle: string;
  msgSub: string;
  callTitle: string;
  waTitle: string;
  waSub: string;
  waPlaceholder: string;
  waPhoneQuestion: string;
  waPhonePlaceholder: string;
  waSearchPlaceholder: string;
  formTitle: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
  submit: string;
  successTitle: string;
  successBody: string;
  successBack: string;
  errorRequired: string;
  errorEmail: string;
  errorPhone: string;
  errorSend: string;
}

export interface WidgetConfig {
  projectId: string;
  companyName: string;
  agentName: string;
  agentPhoto: string;
  greeting: string;
  phone: string | null;
  whatsapp: string | null;
  channels: ChannelId[];
  position: 'right' | 'left';
  offset: { bottom: number; side: number };
  teaser: boolean;
  defaultCountry: string;
  theme: WidgetTheme;
  formNames: Record<'message' | 'whatsapp', string>;
  texts: WidgetTexts;
  endpoint: string;
}

export const DEFAULT_ENDPOINT = 'https://app.leadtrackr.io/api/leads/createLead';

const DEFAULT_THEME: WidgetTheme = {
  primary: '#52B483',
  primaryHover: '#3E8762',
  primaryTint: '#EDF8F2',
  launcherBorder: '#52B483',
  headerBg: '#FFFFFF',
  headerText: '#020A24',
  panelBg: '#FFFFFF',
  text: '#1F2937',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  error: '#FF6A6A',
  radius: 16,
};

const DEFAULT_TEXTS: WidgetTexts = {
  from: 'van',
  online: 'Online — we reageren direct',
  launcherLabel: 'Neem contact op',
  close: 'Sluiten',
  back: 'Terug',
  msgTitle: 'Stuur een bericht',
  msgSub: 'We reageren zo snel mogelijk',
  callTitle: 'Bel ons direct',
  waTitle: 'WhatsApp',
  waSub: 'Chat direct met ons',
  waPlaceholder: 'Typ je bericht…',
  waPhoneQuestion: 'Top! Op welk nummer kunnen we je bereiken als het gesprek wegvalt?',
  waPhonePlaceholder: '6 12345678',
  waSearchPlaceholder: 'Zoek land…',
  formTitle: 'Stuur een bericht',
  nameLabel: 'Naam',
  namePlaceholder: 'Je naam',
  emailLabel: 'E-mailadres',
  emailPlaceholder: 'naam@bedrijf.nl',
  messageLabel: 'Bericht',
  messagePlaceholder: 'Waar kunnen we je mee helpen?',
  submit: 'Verstuur bericht',
  successTitle: 'Verzonden!',
  successBody: 'We nemen zo snel mogelijk contact met je op.',
  successBack: 'Terug naar start',
  errorRequired: 'Dit veld is verplicht',
  errorEmail: 'Vul een geldig e-mailadres in',
  errorPhone: 'Vul een geldig telefoonnummer in',
  errorSend: 'Versturen mislukt. Probeer het opnieuw.',
};

export function resolveConfig(projectId: string, user: Partial<WidgetConfig> | undefined): WidgetConfig {
  const u = user || {};
  const requested: ChannelId[] = u.channels && u.channels.length ? u.channels : ['message', 'call', 'whatsapp'];
  const channels = requested.filter((c) => {
    if (c === 'call') return Boolean(u.phone);
    if (c === 'whatsapp') return Boolean(u.whatsapp);
    return c === 'message';
  });
  return {
    projectId,
    companyName: u.companyName || '',
    agentName: u.agentName || '',
    agentPhoto: u.agentPhoto || '',
    greeting: u.greeting || 'Goedendag 👋 Waar kunnen we je mee helpen?',
    phone: u.phone || null,
    whatsapp: u.whatsapp || null,
    channels,
    position: u.position === 'left' ? 'left' : 'right',
    offset: { bottom: u.offset?.bottom ?? 20, side: u.offset?.side ?? 20 },
    teaser: u.teaser !== false,
    defaultCountry: u.defaultCountry || 'NL',
    theme: { ...DEFAULT_THEME, ...(u.theme || {}) },
    formNames: { message: 'Widget — Bericht', whatsapp: 'Widget — WhatsApp', ...(u.formNames || {}) },
    texts: { ...DEFAULT_TEXTS, ...(u.texts || {}) },
    endpoint: u.endpoint || DEFAULT_ENDPOINT,
  };
}
