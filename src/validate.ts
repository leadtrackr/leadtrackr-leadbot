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

/** Een getal met punt of komma als decimaalteken; de komma wint van de locale. */
export function isValidNumber(value: string): boolean {
  const v = value.trim().replace(',', '.');
  return v !== '' && /^-?\d+(\.\d+)?$/.test(v);
}
