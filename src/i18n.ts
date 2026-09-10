export type Language = 'nl' | 'en' | 'de';

export const SUPPORTED_LANGUAGES: Language[] = ['nl', 'en', 'de'];

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
  waiOpening: string;
  waiReopen: string;
  waiDialogLabel: string;
  formTitle: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  phoneLabel: string;
  phonePlaceholder: string;
  emailPlaceholder: string;
  messageLabel: string;
  messagePlaceholder: string;
  submit: string;
  optional: string;
  successTitle: string;
  successBody: string;
  waSuccessTitle: string;
  waSuccessBody: string;
  successBack: string;
  threadRestart: string;
  threadAnotherQuestion: string;
  errorRequired: string;
  errorEmail: string;
  errorPhone: string;
  errorNumber: string;
  errorRange: string;
  errorSend: string;
  errorBlocked: string;
}

// Personal voice ("I" instead of "we") — applied on top of TEXTS when an
// agentName is configured, because a person is shown above the copy.
export const PERSONAL_TEXTS: Record<Language, Partial<LeadBotTexts>> = {
  en: {
    greeting: 'Hi 👋 How can I help you?',
    msgSub: "I'll get back to you as soon as possible",
    callTitle: 'Call me',
    waSub: 'Chat with me directly',
    messagePlaceholder: 'How can I help?',
    successBody: "I'll get back to you as soon as possible.",
  },
  nl: {
    greeting: 'Goedendag 👋 Waar kan ik je mee helpen?',
    msgSub: 'Ik reageer zo snel mogelijk',
    callTitle: 'Bel mij direct',
    waSub: 'Chat direct met mij',
    messagePlaceholder: 'Waar kan ik je mee helpen?',
    successBody: 'Ik neem zo snel mogelijk contact met je op.',
  },
  de: {
    greeting: 'Guten Tag 👋 Wie kann ich Ihnen helfen?',
    msgSub: 'Ich melde mich schnellstmöglich',
    callTitle: 'Rufen Sie mich an',
    waSub: 'Chatten Sie direkt mit mir',
    messagePlaceholder: 'Wie kann ich Ihnen helfen?',
    successBody: 'Ich melde mich schnellstmöglich bei Ihnen.',
  },
};

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
    waiOpening: 'Opening WhatsApp…',
    waiReopen: 'Open WhatsApp again',
    waiDialogLabel: 'Contact via WhatsApp',
    formTitle: 'Send a message',
    nameLabel: 'Name',
    namePlaceholder: 'Your name',
    emailLabel: 'Email address',
    emailPlaceholder: 'name@company.com',
    phoneLabel: 'Phone number',
    phonePlaceholder: '6 12345678',
    messageLabel: 'Message',
    messagePlaceholder: 'How can we help?',
    submit: 'Send message',
    optional: '(optional)',
    successTitle: 'Message sent!',
    successBody: 'We will get back to you as soon as possible.',
    waSuccessTitle: 'WhatsApp opened',
    waSuccessBody: 'WhatsApp has opened in a new tab. Send your message there to start the conversation.',
    successBack: 'Back to start',
    threadRestart: 'Something else',
    threadAnotherQuestion: 'Another question',
    errorRequired: 'This field is required',
    errorEmail: 'Enter a valid email address',
    errorPhone: 'Enter a valid phone number',
    errorNumber: 'Enter a valid number',
    errorRange: 'This value is out of range',
    errorSend: 'Sending failed. Please try again.',
    errorBlocked: 'Sending is currently unavailable.',
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
    waiOpening: 'WhatsApp openen…',
    waiReopen: 'WhatsApp opnieuw openen',
    waiDialogLabel: 'Contact via WhatsApp',
    formTitle: 'Stuur een bericht',
    nameLabel: 'Naam',
    namePlaceholder: 'Je naam',
    emailLabel: 'E-mailadres',
    emailPlaceholder: 'naam@bedrijf.nl',
    phoneLabel: 'Telefoonnummer',
    phonePlaceholder: '6 12345678',
    messageLabel: 'Bericht',
    messagePlaceholder: 'Waar kunnen we je mee helpen?',
    submit: 'Verstuur bericht',
    optional: '(optioneel)',
    successTitle: 'Bericht verzonden!',
    successBody: 'We nemen zo snel mogelijk contact met je op.',
    waSuccessTitle: 'WhatsApp geopend',
    waSuccessBody: 'WhatsApp is geopend in een nieuw tabblad. Verstuur daar je bericht om het gesprek te starten.',
    successBack: 'Terug naar start',
    threadRestart: 'Iets anders bekijken',
    threadAnotherQuestion: 'Nog een vraag',
    errorRequired: 'Dit veld is verplicht',
    errorEmail: 'Vul een geldig e-mailadres in',
    errorPhone: 'Vul een geldig telefoonnummer in',
    errorNumber: 'Vul een geldig getal in',
    errorRange: 'Deze waarde valt buiten het bereik',
    errorSend: 'Versturen mislukt. Probeer het opnieuw.',
    errorBlocked: 'Versturen is op dit moment niet mogelijk.',
  },
  de: {
    greeting: 'Guten Tag 👋 Wie können wir Ihnen helfen?',
    from: 'von',
    responseTime: 'Durchschnittliche Antwortzeit: innerhalb von 15 Minuten',
    launcherLabel: 'Kontakt aufnehmen',
    close: 'Schließen',
    back: 'Zurück',
    msgTitle: 'Nachricht senden',
    msgSub: 'Wir melden uns schnellstmöglich',
    callTitle: 'Rufen Sie uns an',
    waTitle: 'WhatsApp',
    waSub: 'Chatten Sie direkt mit uns',
    waPlaceholder: 'Ihre Nachricht…',
    waPhoneQuestion: 'Mit welcher Telefonnummer möchten Sie das WhatsApp-Gespräch starten?',
    waPhonePlaceholder: '151 23456789',
    waCountryLabel: 'Ländervorwahl',
    waiOpening: 'WhatsApp wird geöffnet…',
    waiReopen: 'WhatsApp erneut öffnen',
    waiDialogLabel: 'Kontakt über WhatsApp',
    formTitle: 'Nachricht senden',
    nameLabel: 'Name',
    namePlaceholder: 'Ihr Name',
    emailLabel: 'E-Mail-Adresse',
    emailPlaceholder: 'name@firma.de',
    phoneLabel: 'Telefonnummer',
    phonePlaceholder: '151 23456789',
    messageLabel: 'Nachricht',
    messagePlaceholder: 'Wie können wir Ihnen helfen?',
    submit: 'Nachricht senden',
    optional: '(optional)',
    successTitle: 'Nachricht gesendet!',
    successBody: 'Wir melden uns schnellstmöglich bei Ihnen.',
    waSuccessTitle: 'WhatsApp geöffnet',
    waSuccessBody: 'WhatsApp wurde in einem neuen Tab geöffnet. Senden Sie dort Ihre Nachricht, um das Gespräch zu starten.',
    successBack: 'Zurück zum Start',
    threadRestart: 'Etwas anderes ansehen',
    threadAnotherQuestion: 'Noch eine Frage',
    errorRequired: 'Dieses Feld ist erforderlich',
    errorEmail: 'Geben Sie eine gültige E-Mail-Adresse ein',
    errorPhone: 'Geben Sie eine gültige Telefonnummer ein',
    errorNumber: 'Geben Sie eine gültige Zahl ein',
    errorRange: 'Dieser Wert liegt außerhalb des zulässigen Bereichs',
    errorSend: 'Senden fehlgeschlagen. Bitte versuchen Sie es erneut.',
    errorBlocked: 'Das Senden ist derzeit nicht möglich.',
  },
};
