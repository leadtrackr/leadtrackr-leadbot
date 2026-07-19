export type Language = 'nl' | 'en';

export const SUPPORTED_LANGUAGES: Language[] = ['nl', 'en'];

export function detectLanguage(langAttr: string | null | undefined): Language {
  const base = (langAttr || '').toLowerCase().split('-')[0];
  return (SUPPORTED_LANGUAGES as string[]).includes(base) ? (base as Language) : 'en';
}

export interface LeadBotTexts {
  greeting: string;
  from: string;
  responseTime: string;
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
  waCountryLabel: string;
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
  waSuccessTitle: string;
  waSuccessBody: string;
  successBack: string;
  errorRequired: string;
  errorEmail: string;
  errorPhone: string;
  errorSend: string;
}

export const TEXTS: Record<Language, LeadBotTexts> = {
  en: {
    greeting: 'Hi 👋 How can we help you?',
    from: 'from',
    responseTime: 'Average response time: within 15 minutes',
    launcherLabel: 'Contact us',
    close: 'Close',
    back: 'Back',
    msgTitle: 'Send a message',
    msgSub: 'We will get back to you as soon as possible',
    callTitle: 'Call us',
    waTitle: 'WhatsApp',
    waSub: 'Chat with us directly',
    waPlaceholder: 'Type your message…',
    waPhoneQuestion: 'Which phone number would you like to start the WhatsApp conversation with?',
    waPhonePlaceholder: '6 12345678',
    waCountryLabel: 'Country code',
    formTitle: 'Send a message',
    nameLabel: 'Name',
    namePlaceholder: 'Your name',
    emailLabel: 'Email address',
    emailPlaceholder: 'name@company.com',
    messageLabel: 'Message',
    messagePlaceholder: 'How can we help?',
    submit: 'Send message',
    successTitle: 'Message sent!',
    successBody: 'We will get back to you as soon as possible.',
    waSuccessTitle: 'WhatsApp opened',
    waSuccessBody: 'WhatsApp has opened in a new tab. Send your message there to start the conversation.',
    successBack: 'Back to start',
    errorRequired: 'This field is required',
    errorEmail: 'Enter a valid email address',
    errorPhone: 'Enter a valid phone number',
    errorSend: 'Sending failed. Please try again.',
  },
  nl: {
    greeting: 'Goedendag 👋 Waar kunnen we je mee helpen?',
    from: 'van',
    responseTime: 'Gemiddelde responstijd: binnen 15 minuten',
    launcherLabel: 'Neem contact op',
    close: 'Sluiten',
    back: 'Terug',
    msgTitle: 'Stuur een bericht',
    msgSub: 'We reageren zo snel mogelijk',
    callTitle: 'Bel ons direct',
    waTitle: 'WhatsApp',
    waSub: 'Chat direct met ons',
    waPlaceholder: 'Typ je bericht…',
    waPhoneQuestion: 'Op welk telefoonnummer wil je het WhatsApp-gesprek starten?',
    waPhonePlaceholder: '6 12345678',
    waCountryLabel: 'Landcode',
    formTitle: 'Stuur een bericht',
    nameLabel: 'Naam',
    namePlaceholder: 'Je naam',
    emailLabel: 'E-mailadres',
    emailPlaceholder: 'naam@bedrijf.nl',
    messageLabel: 'Bericht',
    messagePlaceholder: 'Waar kunnen we je mee helpen?',
    submit: 'Verstuur bericht',
    successTitle: 'Bericht verzonden!',
    successBody: 'We nemen zo snel mogelijk contact met je op.',
    waSuccessTitle: 'WhatsApp geopend',
    waSuccessBody: 'WhatsApp is geopend in een nieuw tabblad. Verstuur daar je bericht om het gesprek te starten.',
    successBack: 'Terug naar start',
    errorRequired: 'Dit veld is verplicht',
    errorEmail: 'Vul een geldig e-mailadres in',
    errorPhone: 'Vul een geldig telefoonnummer in',
    errorSend: 'Versturen mislukt. Probeer het opnieuw.',
  },
};
