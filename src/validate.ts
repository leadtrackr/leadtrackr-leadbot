export interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: 'NL', name: 'Nederland', dial: '+31', flag: '🇳🇱' },
  { code: 'BE', name: 'België', dial: '+32', flag: '🇧🇪' },
  { code: 'DE', name: 'Deutschland', dial: '+49', flag: '🇩🇪' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'ES', name: 'España', dial: '+34', flag: '🇪🇸' },
  { code: 'IT', name: 'Italia', dial: '+39', flag: '🇮🇹' },
  { code: 'AT', name: 'Österreich', dial: '+43', flag: '🇦🇹' },
  { code: 'CH', name: 'Schweiz', dial: '+41', flag: '🇨🇭' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
];

export function normalizePhone(raw: string, dial: string): string | null {
  let v = raw.replace(/[\s\-().]/g, '');
  if (!v) return null;
  if (v.slice(0, 2) === '00') v = '+' + v.slice(2);
  if (v.charAt(0) !== '+') v = dial + v.replace(/^0/, '');
  return /^\+[1-9]\d{7,14}$/.test(v) ? v : null;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}
