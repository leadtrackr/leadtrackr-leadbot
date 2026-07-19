import { detectLanguage, TEXTS, type Language, type LeadBotTexts } from './i18n';
import type { ChannelId } from './types';

export interface LeadBotTheme {
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

export interface LeadBotConfig {
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
  language: Language;
  responseTimeText: string | null;
  theme: LeadBotTheme;
  formNames: Record<'contact_form' | 'whatsapp', string>;
  texts: LeadBotTexts;
  endpoint: string;
}

export const DEFAULT_ENDPOINT = 'https://app.leadtrackr.io/api/leads/createLead';

const DEFAULT_THEME: LeadBotTheme = {
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

export function resolveConfig(projectId: string, user: Partial<LeadBotConfig> | undefined): LeadBotConfig {
  const u = user || {};
  const language = detectLanguage(u.language || document.documentElement.lang);
  const texts: LeadBotTexts = { ...TEXTS[language], ...(u.texts || {}) };
  if (u.responseTimeText) texts.responseTime = u.responseTimeText;
  const requested: ChannelId[] = u.channels && u.channels.length ? u.channels : ['contact_form', 'phone', 'whatsapp'];
  const channels = requested.filter((c) => {
    if (c === 'phone') return Boolean(u.phone);
    if (c === 'whatsapp') return Boolean(u.whatsapp);
    return c === 'contact_form';
  });
  return {
    projectId,
    companyName: u.companyName || '',
    agentName: u.agentName || '',
    agentPhoto: u.agentPhoto || '',
    greeting: u.greeting || texts.greeting,
    phone: u.phone || null,
    whatsapp: u.whatsapp || null,
    channels,
    position: u.position === 'left' ? 'left' : 'right',
    offset: { bottom: u.offset?.bottom ?? 20, side: u.offset?.side ?? 20 },
    teaser: u.teaser !== false,
    defaultCountry: u.defaultCountry || 'NL',
    language,
    responseTimeText: u.responseTimeText || null,
    theme: { ...DEFAULT_THEME, ...(u.theme || {}) },
    formNames: { contact_form: 'LeadBot — Contact form', whatsapp: 'LeadBot — WhatsApp', ...(u.formNames || {}) },
    texts,
    endpoint: u.endpoint || DEFAULT_ENDPOINT,
  };
}
