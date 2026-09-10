# LeadBot gespreksmodus, infokaarten, FAQ en drie veldtypes — Implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** De LeadBot kan een gesprek zijn in plaats van een kanalenlijst, met infokaarten, een FAQ en de veldtypes die het offerteformulier van Van Delft nodig heeft.

**Architecture:** Eén thread-component met state (`messages`, `chips`, `typing`) dient twee ingangen: in lijstmodus is hij de view achter een `faqs`-kanaal, in gespreksmodus (`conversational: true`) is hij bovendien de ingang. Formulieren, WhatsApp en succes blijven exact de bestaande views en worden in gespreksmodus als laag over de thread getoond. Kanaalsoorten (`forms`, `links`, `faqs`) worden op één plek geresolved.

**Tech Stack:** TypeScript zonder dependencies, esbuild → IIFE, Shadow DOM, vitest + happy-dom.

**Spec:** `docs/superpowers/specs/2026-09-10-leadbot-conversational-design.md`

## Global Constraints

- **Naamgeving:** het heet overal **LeadBot**, nooit "widget" — in UI, code, docs en events.
- **Kanaal-id's zijn overal identiek** — in config, code én dataLayer. Geen mappings. `phone` en `whatsapp` zijn gereserveerd; elk ander id komt uit `forms`, `links` of `faqs` en gaat ongewijzigd de dataLayer in.
- **dataLayer blijft plat en ongewijzigd:** alleen `leadtrackr_leadbot_open`, `_channel_click` en `_conversion`, met alleen `event`, `channel` en `user_data`. Geen nieuwe events, geen nieuwe sleutels.
- **Een `links`-kanaal levert nooit een lead of conversie op**, alleen `channel_click`.
- **Alles wordt geëscapet.** Rauwe HTML uit de config wordt nooit gerenderd. Opmaak loopt via `renderText()` uit Taak 3.
- **Repo blijft merk-neutraal:** geen klantnamen, klantkleuren of klantconfig in `src/`, `test/` of `demo/`.
- **Terugwaartse compatibiliteit:** `conversational` is default `false`, `links`/`faqs` zijn additief. Een config zonder die sleutels moet identiek renderen aan v1.11.0.
- **Teksten komen uit `src/i18n.ts`**, nooit hardcoded, en elke nieuwe key krijgt `nl`, `en` én `de`. De Duitse set gebruikt consequent de Sie-vorm; de test in `test/i18n.test.ts` faalt op `du`/`dein`.
- **Reduced motion:** elke animatie of vertraging wordt overgeslagen bij `prefers-reduced-motion`.
- Na elke taak: `npm test` groen, `npx tsc --noEmit` schoon.

## File Structure

| Bestand | Verantwoordelijkheid |
|---|---|
| `src/forms.ts` (wijzigen) | Veldtypes en normalisatie van formulierdefinities |
| `src/validate.ts` (wijzigen) | Losse waardevalidatie (telefoon, e-mail, getal) |
| `src/overlay.ts` (wijzigen) | Taallaag samenvoegen — nu ook opties op `value` |
| `src/links.ts` (nieuw) | Normalisatie van `links`-definities |
| `src/faq.ts` (nieuw) | Normalisatie van `faqs`-definities |
| `src/channels.ts` (nieuw) | Eén antwoord op "wat is dit kanaal-id" |
| `src/ui/richtext.ts` (nieuw) | Geëscapete tekst met minimale opmaak |
| `src/ui/thread.ts` (nieuw) | Rendering van de berichtenweergave |
| `src/ui/threadflow.ts` (nieuw) | Gesprekslogica: welk bericht volgt op welke keuze |
| `src/ui/views.ts` (wijzigen) | Kanaalknoppen en formuliervelden |
| `src/ui/leadbot.ts` (wijzigen) | Schil: kiest de view, routeert kliks |
| `src/ui/icons.ts`, `styles.ts`, `src/i18n.ts`, `src/config.ts` | Iconen, CSS, teksten, config-resolutie |

---

### Task 1: Veldtypes `number` en `date`

**Files:**
- Modify: `src/forms.ts`, `src/validate.ts`, `src/ui/views.ts`, `src/ui/leadbot.ts`, `src/i18n.ts`
- Test: `test/forms.test.ts`, `test/validate.test.ts`, `test/leadbot.test.ts`

**Interfaces:**
- Consumes: niets (eerste taak)
- Produces: `FieldType` bevat `'number' | 'date'`; `FormField` krijgt `min?: number` en `max?: number`; `isValidNumber(value: string): boolean` in `src/validate.ts`; teksten `errorNumber` en `errorRange` in `LeadBotTexts`

- [ ] **Step 1: Write the failing test**

In `test/forms.test.ts`:

```typescript
it('accepts number and date fields, with optional bounds', () => {
  const forms = normalizeForms(
    { offerte: { fields: [
      { key: 'aantal', label: 'Aantal', type: 'number', min: 1, max: 5000 },
      { key: 'leverdatum', label: 'Leverdatum', type: 'date' },
    ] } },
    TEXTS.nl,
    'LeadBot — Contact form',
  );
  const [aantal, datum] = forms.offerte.fields;
  expect(aantal.type).toBe('number');
  expect(aantal.min).toBe(1);
  expect(aantal.max).toBe(5000);
  expect(datum.type).toBe('date');
  expect(datum.min).toBeUndefined();
});
```

In `test/validate.test.ts`:

```typescript
describe('isValidNumber', () => {
  it('accepts whole and decimal numbers, with a comma or a period', () => {
    expect(isValidNumber('250')).toBe(true);
    expect(isValidNumber('2.5')).toBe(true);
    expect(isValidNumber('2,5')).toBe(true);
    expect(isValidNumber('-3')).toBe(true);
  });

  it('rejects anything that is not a number', () => {
    expect(isValidNumber('veel')).toBe(false);
    expect(isValidNumber('')).toBe(false);
    expect(isValidNumber('12stuks')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- forms validate`
Expected: FAIL — `isValidNumber is not a function`, en `aantal.type` is `'text'` omdat `number` nog niet in `FIELD_TYPES` staat.

- [ ] **Step 3: Write minimal implementation**

In `src/validate.ts`:

```typescript
export function isValidNumber(value: string): boolean {
  const v = value.trim().replace(',', '.');
  return v !== '' && /^-?\d+(\.\d+)?$/.test(v);
}
```

In `src/forms.ts` — types uitbreiden en de grenzen meenemen:

```typescript
export type FieldType = 'text' | 'email' | 'tel' | 'textarea' | 'number' | 'date';
const FIELD_TYPES: FieldType[] = ['text', 'email', 'tel', 'textarea', 'number', 'date'];
```

`FormField` en `UserFormField` krijgen allebei `min?: number;` en `max?: number;`. In `normalizeField`, vlak voor de return:

```typescript
  const bounded = type === 'number';
  return {
    key,
    label: u.label || base.label,
    type,
    required: u.required === true,
    placeholder: u.placeholder !== undefined ? u.placeholder : base.placeholder,
    ...(bounded && typeof u.min === 'number' ? { min: u.min } : {}),
    ...(bounded && typeof u.max === 'number' ? { max: u.max } : {}),
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- forms validate`
Expected: PASS

- [ ] **Step 5: Render en valideer de nieuwe types**

`formControl()` in `src/ui/views.ts` valt voor onbekende types al terug op `<input type="${f.type}">`, dus `date` rendert al. `number` heeft alleen de grenzen en een numeriek toetsenbord nodig. Vervang de laatste regel van `formControl`:

```typescript
  const bounds =
    f.type === 'number'
      ? `${f.min !== undefined ? ` min="${f.min}"` : ''}${f.max !== undefined ? ` max="${f.max}"` : ''} inputmode="decimal"`
      : '';
  return `<input class="ltb-input" id="${id}" name="${name}" type="${f.type}" placeholder="${ph}" value="${value}"${bounds}>`;
```

In `submitForm()` in `src/ui/leadbot.ts`, direct na het `f.type === 'email'`-blok:

```typescript
      if (f.type === 'number') {
        if (!isValidNumber(raw)) {
          form.errors[f.key] = t.errorNumber;
          continue;
        }
        const n = Number(raw.replace(',', '.'));
        if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) {
          form.errors[f.key] = t.errorRange;
          continue;
        }
      }
```

Voeg `isValidNumber` toe aan de import uit `'../validate'`.

- [ ] **Step 6: Teksten in drie talen**

In `src/i18n.ts`, `LeadBotTexts` uitbreiden met `errorNumber: string;` en `errorRange: string;`, en per taal invullen:

```typescript
// en
errorNumber: 'Enter a valid number',
errorRange: 'This value is out of range',
// nl
errorNumber: 'Vul een geldig getal in',
errorRange: 'Deze waarde valt buiten het bereik',
// de
errorNumber: 'Geben Sie eine gültige Zahl ein',
errorRange: 'Dieser Wert liegt außerhalb des zulässigen Bereichs',
```

- [ ] **Step 7: Test het gedrag in het formulier**

In `test/leadbot.test.ts`:

```typescript
it('refuses a number outside the configured bounds', async () => {
  const cfg = resolveConfig('p1', {
    forms: { offerte: { fields: [{ key: 'aantal', label: 'Aantal', type: 'number', min: 1, required: true }] } },
    channels: ['offerte'],
  });
  mountLeadBot(cfg);
  const root = document.getElementById('lt-leadbot-host')!.shadowRoot!;
  (root.querySelector('[data-action="open"]') as HTMLElement).click();
  (root.querySelector('[data-action="channel-offerte"]') as HTMLElement).click();
  (root.querySelector('[name="aantal"]') as HTMLInputElement).value = '0';
  (root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true }));
  await Promise.resolve();
  expect(root.textContent).toContain('buiten het bereik');
});
```

- [ ] **Step 8: Run the full suite**

Run: `npm test && npx tsc --noEmit`
Expected: alles groen, geen typefouten.

- [ ] **Step 9: Commit**

```bash
git add src/forms.ts src/validate.ts src/ui/views.ts src/ui/leadbot.ts src/i18n.ts test/
git commit -m "Veldtypes number en date, met optionele grenzen op number"
```

---

### Task 2: Veldtype `checkbox` met vertaalbare opties

**Files:**
- Modify: `src/forms.ts`, `src/overlay.ts`, `src/ui/views.ts`, `src/ui/leadbot.ts`, `src/ui/styles.ts`
- Test: `test/forms.test.ts`, `test/overlay.test.ts`, `test/leadbot.test.ts`

**Interfaces:**
- Consumes: `FieldType` uit Taak 1
- Produces: `FieldType` bevat `'checkbox'`; `FormOption { value: string; label: string }`; `FormField.options?: FormOption[]`; opties in de taallaag voegen samen op `value`

- [ ] **Step 1: Write the failing test**

In `test/forms.test.ts`:

```typescript
it('normalizes checkbox options, accepting a bare string as value and label', () => {
  const forms = normalizeForms(
    { offerte: { fields: [{ key: 'opties', label: 'Optioneel', type: 'checkbox', options: [
      { value: 'boodschap', label: 'Met persoonlijke boodschap' },
      'multi-adres',
    ] } ] } },
    TEXTS.nl,
    'LeadBot — Contact form',
  );
  expect(forms.offerte.fields[0].options).toEqual([
    { value: 'boodschap', label: 'Met persoonlijke boodschap' },
    { value: 'multi-adres', label: 'multi-adres' },
  ]);
});

it('keeps a checkbox without options as a single tick box', () => {
  const forms = normalizeForms(
    { f: { fields: [{ key: 'nieuwsbrief', label: 'Houd mij op de hoogte', type: 'checkbox' }] } },
    TEXTS.nl,
    'LeadBot — Contact form',
  );
  expect(forms.f.fields[0].type).toBe('checkbox');
  expect(forms.f.fields[0].options).toBeUndefined();
});
```

In `test/overlay.test.ts`:

```typescript
it('translates option labels without moving the stored value', () => {
  const cfg: UserConfig = {
    forms: { offerte: { fields: [{ key: 'opties', type: 'checkbox', options: [
      { value: 'boodschap', label: 'Met persoonlijke boodschap' },
      { value: 'multi-adres', label: 'Verzending naar meerdere adressen' },
    ] }] } },
    byLanguage: { de: { forms: { offerte: { fields: [{ key: 'opties', options: [
      { value: 'boodschap', label: 'Mit persönlicher Botschaft' },
    ] }] } } } },
  };
  const options = applyLanguageOverlay(cfg, 'de')!.forms!.offerte.fields![0].options!;
  expect(options).toEqual([
    { value: 'boodschap', label: 'Mit persönlicher Botschaft' },
    { value: 'multi-adres', label: 'Verzending naar meerdere adressen' },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- forms overlay`
Expected: FAIL — `options` bestaat niet op `FormField`, en de overlay vervangt de hele array in plaats van per `value` samen te voegen.

- [ ] **Step 3: Write minimal implementation**

In `src/forms.ts`:

```typescript
export type FieldType = 'text' | 'email' | 'tel' | 'textarea' | 'number' | 'date' | 'checkbox';
const FIELD_TYPES: FieldType[] = ['text', 'email', 'tel', 'textarea', 'number', 'date', 'checkbox'];

/** Een keuze bewaart een stabiele `value`; alleen het `label` wordt vertaald. */
export interface FormOption {
  value: string;
  label: string;
}

export type UserFormOption = string | { value: string; label?: string };

function normalizeOptions(list: UserFormOption[] | undefined): FormOption[] | undefined {
  if (!list || !list.length) return undefined;
  const out: FormOption[] = [];
  for (const o of list) {
    if (typeof o === 'string') {
      if (o) out.push({ value: o, label: o });
      continue;
    }
    if (o && o.value) out.push({ value: o.value, label: o.label || o.value });
  }
  return out.length ? out : undefined;
}
```

`FormField` krijgt `options?: FormOption[]`, `UserFormField` krijgt `options?: UserFormOption[]`. In `normalizeField` de opties meenemen:

```typescript
  const options = type === 'checkbox' ? normalizeOptions(u.options) : undefined;
  // ... en in de return:
  ...(options ? { options } : {}),
```

In `src/overlay.ts`, naast `mergeFields`:

```typescript
/**
 * Opties volgen dezelfde regel als velden: de basis bepaalt welke er zijn en in
 * welke volgorde, de taallaag levert alleen de vertaalde labels. De `value`
 * blijft dus in elke taal gelijk en de lead is over talen heen te vergelijken.
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
    const translated = byValue.get(valueOf(o));
    byValue.delete(valueOf(o));
    if (!translated) return o;
    return { value: valueOf(o), label: typeof translated === 'string' ? translated : translated.label || valueOf(o) };
  });
  return [...merged, ...overlay.filter((o) => byValue.has(valueOf(o)))];
}
```

En in `mergeFields`, bij het samenvoegen van een veld:

```typescript
    return translated ? { ...f, ...translated, options: mergeOptions(f.options, translated.options) } : f;
```

Let op: als geen van beide opties heeft, geeft `mergeOptions` `undefined` terug en blijft de sleutel weg uit het resultaat — controleer dat met een test dat een tekstveld door de taallaag geen lege `options` krijgt.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- forms overlay`
Expected: PASS

- [ ] **Step 5: Render de keuzegroep**

In `src/ui/views.ts`, boven `formControl`:

```typescript
function checkboxControl(f: FormField, s: FormState): string {
  const chosen = (s.values[f.key] || '').split(', ').filter(Boolean);
  const boxes = (f.options || [{ value: 'true', label: f.label }]).map((o, i) => {
    const id = `ltb-f-${f.key}-${i}`;
    const checked = chosen.indexOf(o.value) !== -1 ? ' checked' : '';
    return `<label class="ltb-check" for="${id}">
      <input type="checkbox" id="${id}" name="${esc(f.key)}" value="${esc(o.value)}"${checked}>
      <span>${esc(o.label)}</span>
    </label>`;
  });
  return `<div class="ltb-checks" role="group" aria-label="${esc(f.label)}">${boxes.join('')}</div>`;
}
```

In `formControl`, vóór de `textarea`-tak:

```typescript
  if (f.type === 'checkbox') return checkboxControl(f, s);
```

Een keuzegroep heeft geen enkel invoerveld om een `<label for>` aan te hangen, dus `formView` mag er geen koplabel omheen zetten als het veld opties heeft. Pas de `.map` in `formView` aan:

```typescript
    .map((f) =>
      f.type === 'checkbox' && f.options
        ? `<div class="ltb-field${s.errors[f.key] ? ' ltb-invalid' : ''}">
             <p class="ltb-checks-label">${esc(f.label)}${f.required ? '' : ` <span class="ltb-optional">${esc(t.optional)}</span>`}</p>
             ${formControl(f, s, cfg, countries)}
             ${s.errors[f.key] ? `<p class="ltb-error" role="alert">${icons.errorInfo(13)} ${esc(s.errors[f.key])}</p>` : ''}
           </div>`
        : field('ltb-f-' + f.key, f.label, f.required ? '' : t.optional, formControl(f, s, cfg, countries), s.errors[f.key]),
    )
```

CSS in `src/ui/styles.ts` (`.ltb-checks`, `.ltb-check`, `.ltb-checks-label`): kolom met 8px afstand, elk vinkje een rij met `align-items:flex-start` en 10px tussen vakje en tekst, `accent-color: var(--p)`, tekstgrootte gelijk aan `.ltb-field label`.

- [ ] **Step 6: Lees de groep uit en valideer**

`readFormInputs()` in `src/ui/leadbot.ts` leest nu één element per key; een groep heeft er meer:

```typescript
  function readFormInputs(): void {
    for (const f of form.def.fields) {
      if (f.type === 'checkbox') {
        const boxes = Array.from(
          container.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${f.key}"]`),
        );
        form.values[f.key] = boxes.filter((b) => b.checked).map((b) => b.value).join(', ');
        continue;
      }
      const el = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${f.key}"]`);
      if (el) form.values[f.key] = el.value.trim();
    }
  }
```

Verplicht betekent "minstens één aangevinkt", en dat is precies wat de bestaande lege-waarde-check al doet: een groep zonder vinkjes levert een lege string en valt in de `if (!raw)`-tak met `errorRequired`. Er is dus géén extra validatiecode nodig — leg dat vast met een test in plaats van met een regel code.

- [ ] **Step 7: Test het gedrag**

In `test/leadbot.test.ts`:

```typescript
it('sends the values of the ticked options, joined', async () => {
  // monteer een formulier met een keuzegroep, vink de eerste en derde aan,
  // verstuur, en lees de payload uit de gemockte fetch:
  expect(sent.formData.formFields.opties).toBe('boodschap, multi-adres');
});

it('treats a required option group with nothing ticked as empty', async () => {
  expect(root.textContent).toContain('Dit veld is verplicht');
});
```

- [ ] **Step 8: Run the full suite**

Run: `npm test && npx tsc --noEmit`

- [ ] **Step 9: Commit**

```bash
git add src/forms.ts src/overlay.ts src/ui/views.ts src/ui/leadbot.ts src/ui/styles.ts test/
git commit -m "Veldtype checkbox, met opties die per taal alleen hun label wisselen"
```

---

### Task 3: `renderText()` — geëscapete tekst met minimale opmaak

**Files:**
- Create: `src/ui/richtext.ts`, `test/richtext.test.ts`

**Interfaces:**
- Consumes: `esc()` uit `src/ui/views.ts`
- Produces: `renderText(source: string): string` — geeft HTML terug met `<p>` per alinea en `<strong>` voor `**vet**`, al het overige geëscapet

- [ ] **Step 1: Write the failing test**

`test/richtext.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { renderText } from '../src/ui/richtext';

describe('renderText', () => {
  it('wraps a single line in one paragraph', () => {
    expect(renderText('Hallo')).toBe('<p>Hallo</p>');
  });

  it('starts a new paragraph on a blank line and breaks on a single newline', () => {
    expect(renderText('Een\n\nTwee')).toBe('<p>Een</p><p>Twee</p>');
    expect(renderText('Een\nTwee')).toBe('<p>Een<br>Twee</p>');
  });

  it('turns **text** into strong', () => {
    expect(renderText('Wist je dat je **gratis** kunt proeven?')).toBe(
      '<p>Wist je dat je <strong>gratis</strong> kunt proeven?</p>',
    );
  });

  it('escapes everything else, including markup that looks like a tag', () => {
    expect(renderText('<script>alert(1)</script>')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
    expect(renderText('a & b')).toBe('<p>a &amp; b</p>');
  });

  it('leaves an unmatched asterisk pair alone', () => {
    expect(renderText('2 ** 3')).toBe('<p>2 ** 3</p>');
  });

  it('returns an empty string for empty input', () => {
    expect(renderText('')).toBe('');
    expect(renderText('   ')).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- richtext`
Expected: FAIL — module `src/ui/richtext.ts` bestaat niet.

- [ ] **Step 3: Write minimal implementation**

`src/ui/richtext.ts`:

```typescript
import { esc } from './views';

/**
 * Berichten en FAQ-antwoorden komen uit de config van de klantsite. Die worden
 * eerst volledig geëscapet en pas daarna krijgt een handjevol tekens betekenis:
 * `**vet**` en een lege regel als alinea. Zo kan er nooit HTML uit een config
 * de pagina in, ook niet als die config door iemand anders is gezet.
 */
export function renderText(source: string): string {
  const text = (source || '').trim();
  if (!text) return '';
  return text
    .split(/\n\s*\n/)
    .map((para) => {
      const body = esc(para.trim())
        .replace(/\*\*(\S(?:[\s\S]*?\S)?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      return `<p>${body}</p>`;
    })
    .join('');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- richtext`
Expected: PASS. Let op de test met `2 ** 3`: het patroon eist een niet-witruimteteken direct na de openende sterretjes, dus die blijft staan.

- [ ] **Step 5: Commit**

```bash
git add src/ui/richtext.ts test/richtext.test.ts
git commit -m "renderText: geescapete tekst met vet en alinea's"
```

---

### Task 4: `links`-kanaal en kanaalresolutie

**Files:**
- Create: `src/links.ts`, `src/channels.ts`, `test/channels.test.ts`
- Modify: `src/config.ts`, `src/ui/views.ts`, `src/ui/leadbot.ts`, `src/ui/icons.ts`, `src/ui/styles.ts`
- Test: `test/leadbot.test.ts`

**Interfaces:**
- Consumes: `FormDef` uit `src/forms.ts`
- Produces:
  - `LinkDef { id, title, sub, icon, message, button: { label, url } }` in `src/links.ts`, plus `normalizeLinks(user, texts): Record<string, LinkDef>`
  - `resolveChannel(cfg, id): { kind: 'form'; def: FormDef } | { kind: 'link'; def: LinkDef } | { kind: 'phone' } | { kind: 'whatsapp' } | null` in `src/channels.ts`
  - `cfg.links: Record<string, LinkDef>`
  - iconen `icons.info(w)` en `icons.help(w)`

- [ ] **Step 1: Write the failing test**

`test/channels.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config';
import { resolveChannel } from '../src/channels';

const base = {
  phone: '+31 20 1234567',
  whatsapp: '+31612345678',
  channels: ['winkels', 'contact_form', 'phone', 'whatsapp'],
  links: {
    winkels: {
      title: 'Winkels',
      sub: 'Vind een winkel',
      icon: 'info' as const,
      message: '**Onze winkels**\n\nVind er een bij jou in de buurt.',
      button: { label: 'Zoek een winkel', url: '/winkels' },
    },
  },
};

describe('resolveChannel', () => {
  it('names the kind behind each channel id', () => {
    const cfg = resolveConfig('p1', base);
    expect(resolveChannel(cfg, 'winkels')!.kind).toBe('link');
    expect(resolveChannel(cfg, 'contact_form')!.kind).toBe('form');
    expect(resolveChannel(cfg, 'phone')!.kind).toBe('phone');
    expect(resolveChannel(cfg, 'whatsapp')!.kind).toBe('whatsapp');
    expect(resolveChannel(cfg, 'bestaat-niet')).toBeNull();
  });

  it('drops a link without a url, like a form without usable fields', () => {
    const cfg = resolveConfig('p1', {
      channels: ['kapot'],
      links: { kapot: { title: 'Kapot', button: { label: 'Ga', url: '' } } },
    } as never);
    expect(cfg.channels).toEqual([]);
    expect(resolveChannel(cfg, 'kapot')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- channels`
Expected: FAIL — `src/channels.ts` bestaat niet.

- [ ] **Step 3: Write minimal implementation**

`src/links.ts`:

```typescript
import type { FormIcon } from './forms';
import type { LeadBotTexts } from './i18n';

/** Een infokaart: een bericht met één knop naar een pagina. Levert geen lead op. */
export interface LinkDef {
  id: string;
  title: string;
  sub: string;
  icon: FormIcon;
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

export function normalizeLinks(
  user: Record<string, UserLinkDef> | undefined,
  texts: LeadBotTexts,
): Record<string, LinkDef> {
  const out: Record<string, LinkDef> = {};
  for (const id of Object.keys(user || {})) {
    const u = (user || {})[id] || {};
    const url = (u.button && u.button.url) || '';
    // Zonder doel valt er niets te openen; dan liever geen knop dan een dode knop.
    if (!url) continue;
    out[id] = {
      id,
      title: u.title || id,
      sub: u.sub || '',
      icon: u.icon || 'info',
      message: u.message || '',
      button: { label: (u.button && u.button.label) || u.title || id, url },
    };
  }
  return out;
}
```

`src/channels.ts`:

```typescript
import type { LeadBotConfig } from './config';
import type { FormDef } from './forms';
import type { LinkDef } from './links';

export type ResolvedChannel =
  | { kind: 'form'; def: FormDef }
  | { kind: 'link'; def: LinkDef }
  | { kind: 'phone' }
  | { kind: 'whatsapp' };

/**
 * De enige plek die weet wat een kanaal-id betekent. `phone` en `whatsapp` zijn
 * gereserveerd; elk ander id komt uit een van de kanaalmaps in de config.
 */
export function resolveChannel(cfg: LeadBotConfig, id: string): ResolvedChannel | null {
  if (id === 'phone') return { kind: 'phone' };
  if (id === 'whatsapp') return { kind: 'whatsapp' };
  if (cfg.forms[id]) return { kind: 'form', def: cfg.forms[id] };
  if (cfg.links[id]) return { kind: 'link', def: cfg.links[id] };
  return null;
}
```

In `src/config.ts`: `links: Record<string, LinkDef>` op `LeadBotConfig`, `links?: Record<string, UserLinkDef>` op `UserConfig`, `const links = normalizeLinks(u.links, texts);` in `resolveConfig`, en het kanaalfilter uitbreiden:

```typescript
  const channels = requested.filter((c) => {
    if (c === 'phone') return Boolean(u.phone) || Boolean(callTracking);
    if (c === 'whatsapp') return Boolean(u.whatsapp);
    return Boolean(forms[c]) || Boolean(links[c]);
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- channels`
Expected: PASS

- [ ] **Step 5: Toon het linkkanaal in de kanalenlijst**

Twee iconen erbij in `src/ui/icons.ts`:

```typescript
  info: (w = 20) =>
    S(w, '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>', 1.8),
  help: (w = 20) =>
    S(w, '<circle cx="12" cy="12" r="10"></circle><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line>', 1.8),
```

`FormIcon` in `src/forms.ts` uitbreiden naar `'chat' | 'phone' | 'mail' | 'whatsapp' | 'info' | 'help'` en `FORM_ICONS` mee.

In `panelView()` in `src/ui/views.ts`, in de `.map` na de `whatsapp`-tak:

```typescript
      const link = cfg.links[c];
      if (link) {
        // In lijstmodus is een infokaart een knop die meteen doorstuurt; het
        // bericht eromheen heeft alleen betekenis in een gesprek.
        return channelButton('channel-' + c, icons[link.icon](20), link.title, link.sub, link.button.url);
      }
```

In `src/ui/leadbot.ts` moet een klik op zo'n kanaal wel gemeten worden. In de `default`-tak van de click-handler:

```typescript
      default:
        if (action.slice(0, 8) === 'channel-') {
          const id = action.slice(8);
          const resolved = resolveChannel(cfg, id);
          if (!resolved) break;
          if (resolved.kind === 'link') {
            // Geen lead, geen conversie: een infokaart is een doorverwijzing.
            pushChannelClick(id);
            break; // de <a> navigeert zelf verder
          }
          openForm(id);
        }
```

- [ ] **Step 6: Test dat een link meet maar geen conversie stuurt**

In `test/leadbot.test.ts`:

```typescript
it('reports a link channel as a click and never as a conversion', () => {
  // klik het kanaal aan en lees window.dataLayer uit
  expect(events.map((e) => e.event)).toEqual(['leadtrackr_leadbot_open', 'leadtrackr_leadbot_channel_click']);
  expect(events[1].channel).toBe('winkels');
});
```

- [ ] **Step 7: Run the full suite**

Run: `npm test && npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add src/links.ts src/channels.ts src/config.ts src/ui/ test/
git commit -m "links-kanaal: infokaart als kanaalsoort, met kanaalresolutie op een plek"
```

---

### Task 5: De thread-component

**Files:**
- Create: `src/ui/thread.ts`, `test/thread.test.ts`
- Modify: `src/ui/styles.ts`, `src/i18n.ts`

**Interfaces:**
- Consumes: `renderText()` uit Taak 3, `esc()` en `avatar()` uit `src/ui/views.ts`
- Produces:
  - `ThreadMessage { from: 'bot' | 'user'; text: string; button?: { label: string; url: string } }`
  - `ThreadChip { id: string; label: string; style?: 'featured' | 'quiet' }`
  - `ThreadState { channel: string | null; messages: ThreadMessage[]; chips: ThreadChip[]; typing: boolean; entered: boolean }`
  - `threadView(cfg: LeadBotConfig, s: ThreadState, opts: { back: boolean }): string`
  - teksten `threadRestart` en `threadAnotherQuestion` in `LeadBotTexts`

- [ ] **Step 1: Write the failing test**

`test/thread.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config';
import { threadView, type ThreadState } from '../src/ui/thread';

const state = (over: Partial<ThreadState> = {}): ThreadState => ({
  channel: 'faq', messages: [], chips: [], typing: false, entered: true, ...over,
});

describe('threadView', () => {
  const cfg = resolveConfig('p1', { agentName: 'Ronald', companyName: 'Test' });

  it('renders a bot message with formatting and a user message as plain text', () => {
    const html = threadView(cfg, state({ messages: [
      { from: 'bot', text: '**Hallo** daar' },
      { from: 'user', text: 'Wat zijn **jullie** openingstijden?' },
    ] }), { back: true });
    expect(html).toContain('<strong>Hallo</strong>');
    expect(html).toContain('ltb-user');
    // de gebruiker typt geen opmaak: zijn tekst wordt letterlijk getoond
    expect(html).toContain('**jullie**');
    expect(html).not.toContain('<strong>jullie</strong>');
  });

  it('renders a button inside a bot message', () => {
    const html = threadView(cfg, state({ messages: [
      { from: 'bot', text: 'Kijk hier', button: { label: 'Winkelpagina', url: '/winkels' } },
    ] }), { back: true });
    expect(html).toContain('ltb-cardbtn');
    expect(html).toContain('href="/winkels"');
    expect(html).toContain('Winkelpagina');
  });

  it('renders chips with their styles and a data-action per chip', () => {
    const html = threadView(cfg, state({ chips: [
      { id: 'whatsapp', label: 'WhatsApp', style: 'featured' },
      { id: 'restart', label: 'Iets anders bekijken', style: 'quiet' },
    ] }), { back: true });
    expect(html).toContain('data-action="chip-whatsapp"');
    expect(html).toContain('ltb-opt--featured');
    expect(html).toContain('ltb-opt--quiet');
  });

  it('shows the typing indicator instead of chips while typing', () => {
    const html = threadView(cfg, state({ typing: true, chips: [{ id: 'a', label: 'A' }] }), { back: true });
    expect(html).toContain('ltb-typing');
    expect(html).not.toContain('data-action="chip-a"');
  });

  it('escapes anything a config puts in a chip label', () => {
    const html = threadView(cfg, state({ chips: [{ id: 'x', label: '<img src=x onerror=1>' }] }), { back: true });
    expect(html).not.toContain('<img');
  });

  it('shows a back button only when asked', () => {
    expect(threadView(cfg, state(), { back: true })).toContain('data-action="back"');
    expect(threadView(cfg, state(), { back: false })).not.toContain('data-action="back"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- thread`
Expected: FAIL — `src/ui/thread.ts` bestaat niet.

- [ ] **Step 3: Write minimal implementation**

`src/ui/thread.ts`:

```typescript
import type { LeadBotConfig } from '../config';
import { icons } from './icons';
import { renderText } from './richtext';
import { avatar, brandFooter, esc } from './views';

export interface ThreadMessage {
  from: 'bot' | 'user';
  /** Bot-tekst mag opmaak bevatten; gebruikerstekst nooit. */
  text: string;
  button?: { label: string; url: string };
}

export interface ThreadChip {
  id: string;
  label: string;
  style?: 'featured' | 'quiet';
}

export interface ThreadState {
  /** Het kanaal dat dit gesprek voert; null in de gespreksmodus-ingang. */
  channel: string | null;
  messages: ThreadMessage[];
  chips: ThreadChip[];
  typing: boolean;
  /** False bij de eerste render na een nieuwe stap, zodat animaties één keer spelen. */
  entered: boolean;
}

function message(cfg: LeadBotConfig, m: ThreadMessage): string {
  if (m.from === 'user') return `<div class="ltb-user">${esc(m.text)}</div>`;
  const button = m.button
    ? `<a class="ltb-cardbtn" href="${esc(m.button.url)}" data-action="card-link"><span>${esc(m.button.label)}</span>${icons.chevronRight(16)}</a>`
    : '';
  return `<div class="ltb-bot">${renderText(m.text)}${button}</div>`;
}

export function threadView(
  cfg: LeadBotConfig,
  s: ThreadState,
  opts: { back: boolean },
): string {
  const t = cfg.texts;
  const body = s.messages.map((m) => message(cfg, m)).join('');
  const typing = s.typing ? '<div class="ltb-typing"><span></span><span></span><span></span></div>' : '';
  const chips = s.typing
    ? ''
    : `<div class="ltb-opts">${s.chips
        .map(
          (c) =>
            `<button type="button" class="ltb-opt${c.style ? ' ltb-opt--' + c.style : ''}" data-action="chip-${esc(c.id)}">${esc(c.label)}</button>`,
        )
        .join('')}</div>`;
  const back = opts.back
    ? `<button class="ltb-back" data-action="back" aria-label="${esc(t.back)}">${icons.back(18)}</button>`
    : '';
  return `
  <div class="ltb-handle"><span></span></div>
  <div class="ltb-wa-head">
    ${back}
    ${avatar(cfg, 'ltb-avatar-fallback')}
    <div>
      <p class="ltb-wa-head-name">${esc(cfg.agentName || cfg.companyName)}</p>
      <p class="ltb-wa-head-status">${esc(t.responseTime)}</p>
    </div>
    <button class="ltb-close" data-action="close" aria-label="${esc(t.close)}">${icons.close(15)}</button>
  </div>
  <div class="ltb-thread${s.entered ? ' ltb-static' : ''}" role="log" aria-live="polite">
    ${body}${typing}${chips}
  </div>
  ${brandFooter(cfg)}`;
}
```

`avatar` en `brandFooter` moeten geëxporteerd zijn uit `views.ts`; `brandFooter` is dat al, `avatar` nog niet — zet er `export` voor.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- thread`
Expected: PASS

- [ ] **Step 5: CSS uit het artifact overzetten**

Voeg in `src/ui/styles.ts` de componenten toe die in de demo staan en hier ontbreken. De demo gebruikt exact dezelfde variabelen (`--p`, `--p-rgb`, `--tint`, `--bd`, `--tx`, `--mut`, `--r`), dus dit is overzetten, niet opnieuw ontwerpen:

- `.ltb-thread` — scrollgebied, `display:flex;flex-direction:column;gap:10px`, `padding:16px`, `overflow-y:auto`, `max-height` zoals het paneel
- `.ltb-bot` — bubbel links, `background:var(--tint)`, `border-radius:14px 14px 14px 4px`, `padding:11px 14px`, `max-width:85%`, `align-self:flex-start`; `p` erbinnen zonder marge, tussen twee `p` een `margin-top:8px`
- `.ltb-user` — bubbel rechts, `background:var(--p)`, `color:#fff`, `border-radius:14px 14px 4px 14px`, `align-self:flex-end`
- `.ltb-typing` — drie stippen met `ltb-dot`-animatie, in dezelfde bubbelvorm als `.ltb-bot`
- `.ltb-opts` — `display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end`
- `.ltb-opt` — chip: `border:1px solid var(--bd)`, `border-radius:999px`, `padding:8px 14px`, `background:#fff`, hover `background:var(--tint)`
- `.ltb-opt--featured` — `background:var(--p);color:#fff;border-color:var(--p)`
- `.ltb-opt--quiet` — `color:var(--mut);border-style:dashed`
- `.ltb-cardbtn` — knop in een bubbel: volle breedte, `border:1px solid var(--bd)`, `border-radius:10px`, `margin-top:10px`, tekst links en chevron rechts
- `@keyframes ltb-dot` en, binnen `@media (prefers-reduced-motion: reduce)`, `animation:none` voor `.ltb-typing span`

- [ ] **Step 6: Teksten in drie talen**

In `src/i18n.ts` toevoegen aan `LeadBotTexts` en alle drie de talen:

```typescript
// en
threadRestart: 'Something else',
threadAnotherQuestion: 'Another question',
// nl
threadRestart: 'Iets anders bekijken',
threadAnotherQuestion: 'Nog een vraag',
// de
threadRestart: 'Etwas anderes ansehen',
threadAnotherQuestion: 'Noch eine Frage',
```

- [ ] **Step 7: Run the full suite**

Run: `npm test && npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add src/ui/thread.ts src/ui/styles.ts src/ui/views.ts src/i18n.ts test/thread.test.ts
git commit -m "Thread-component: bubbels, chips en typ-indicator"
```

---

### Task 6: `faqs`-kanaal en de gesprekslogica

**Files:**
- Create: `src/faq.ts`, `src/ui/threadflow.ts`, `test/faq.test.ts`, `test/threadflow.test.ts`
- Modify: `src/config.ts`, `src/channels.ts`, `src/ui/views.ts`, `src/ui/leadbot.ts`
- Test: `test/leadbot.test.ts`

**Interfaces:**
- Consumes: `ThreadState`/`ThreadChip` uit Taak 5, `resolveChannel` uit Taak 4
- Produces:
  - `FaqDef { id, title, sub, icon, intro, questions: FaqQuestion[], followUp: string[] }` en `FaqQuestion { q, a, button? }` in `src/faq.ts`
  - `normalizeFaqs(user, texts): Record<string, FaqDef>`
  - `cfg.faqs: Record<string, FaqDef>`
  - `resolveChannel` kent nu ook `{ kind: 'faq'; def: FaqDef }`
  - in `src/ui/threadflow.ts`: `openFaq(cfg, def): ThreadState` en `answerQuestion(cfg, def, state, index): ThreadState`

- [ ] **Step 1: Write the failing test**

`test/threadflow.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { resolveConfig } from '../src/config';
import { answerQuestion, openFaq } from '../src/ui/threadflow';

const cfg = resolveConfig('p1', {
  whatsapp: '+31612345678',
  phone: '+31 20 1234567',
  channels: ['faq', 'whatsapp', 'phone'],
  faqs: { faq: {
    intro: 'Waar kan ik je mee helpen?',
    questions: [
      { q: 'Openingstijden?', a: 'Kijk op de **winkelpagina**.', button: { label: 'Winkelpagina', url: '/winkels' } },
      { q: 'Levertijd?', a: 'Voor 23:00 besteld, morgen in huis.' },
    ],
    followUp: ['whatsapp', 'phone'],
  } },
});
const def = cfg.faqs.faq;

describe('FAQ-gesprek', () => {
  it('opens with the intro and one chip per question', () => {
    const s = openFaq(cfg, def);
    expect(s.messages).toEqual([{ from: 'bot', text: 'Waar kan ik je mee helpen?' }]);
    expect(s.chips.map((c) => c.label)).toEqual(['Openingstijden?', 'Levertijd?']);
  });

  it('echoes the question, then answers it with its button', () => {
    const s = answerQuestion(cfg, def, openFaq(cfg, def), 0);
    expect(s.messages[1]).toEqual({ from: 'user', text: 'Openingstijden?' });
    expect(s.messages[2].from).toBe('bot');
    expect(s.messages[2].text).toContain('winkelpagina');
    expect(s.messages[2].button).toEqual({ label: 'Winkelpagina', url: '/winkels' });
  });

  it('offers the remaining questions plus the follow-up channels', () => {
    const s = answerQuestion(cfg, def, openFaq(cfg, def), 0);
    const ids = s.chips.map((c) => c.id);
    expect(ids).toContain('q1');          // de vraag die nog niet gesteld is
    expect(ids).not.toContain('q0');      // de gestelde vraag komt niet terug
    expect(ids).toContain('whatsapp');
    expect(ids).toContain('phone');
    expect(s.chips[s.chips.length - 1].style).toBe('quiet'); // afsluiter
  });

  it('marks the thread as not yet entered so the typing animation plays once', () => {
    expect(answerQuestion(cfg, def, openFaq(cfg, def), 0).entered).toBe(false);
  });
});
```

`test/faq.test.ts`:

```typescript
it('drops a faq without usable questions', () => {
  const cfg = resolveConfig('p1', { channels: ['faq'], faqs: { faq: { questions: [] } } } as never);
  expect(cfg.channels).toEqual([]);
});

it('ignores a follow-up channel that does not exist', () => {
  const cfg = resolveConfig('p1', {
    channels: ['faq'],
    faqs: { faq: { questions: [{ q: 'A?', a: 'B' }], followUp: ['whatsapp', 'bestaat-niet'] } },
  } as never);
  // zonder whatsapp-nummer blijft er geen enkel doorloopkanaal over
  expect(cfg.faqs.faq.followUp).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- faq threadflow`
Expected: FAIL — `src/faq.ts` en `src/ui/threadflow.ts` bestaan niet.

- [ ] **Step 3: Write minimal implementation**

`src/faq.ts` volgt de vorm van `src/links.ts`: `normalizeFaqs(user, texts)` maakt per id een `FaqDef`, laat een faq zonder bruikbare vraag (`q` én `a` gevuld) weg, en filtert `followUp` op ids die daadwerkelijk bestaan. Dat filteren gebeurt in `resolveConfig`, ná `forms`, `links` en het kanaalfilter, omdat het de andere kanalen nodig heeft:

```typescript
  const faqs = normalizeFaqs(u.faqs, texts);
  for (const id of Object.keys(faqs)) {
    faqs[id].followUp = faqs[id].followUp.filter((c) => channels.indexOf(c) !== -1);
  }
```

`src/ui/threadflow.ts` — bewust pure functies zonder DOM, zodat de gesprekslogica los te testen is van de rendering:

```typescript
import type { LeadBotConfig } from '../config';
import type { FaqDef } from '../faq';
import type { ThreadChip, ThreadState } from './thread';

function channelChip(cfg: LeadBotConfig, id: string): ThreadChip | null {
  if (id === 'whatsapp') return { id, label: cfg.texts.waTitle };
  if (id === 'phone') return { id, label: cfg.texts.callTitle };
  const form = cfg.forms[id];
  if (form) return { id, label: form.title };
  const link = cfg.links[id];
  return link ? { id, label: link.title } : null;
}

export function openFaq(cfg: LeadBotConfig, def: FaqDef): ThreadState {
  return {
    channel: def.id,
    messages: [{ from: 'bot', text: def.intro }],
    chips: def.questions.map((q, i) => ({ id: 'q' + i, label: q.q })),
    typing: false,
    entered: false,
  };
}

export function answerQuestion(
  cfg: LeadBotConfig,
  def: FaqDef,
  state: ThreadState,
  index: number,
): ThreadState {
  const q = def.questions[index];
  if (!q) return state;
  const asked = state.messages
    .filter((m) => m.from === 'user')
    .map((m) => m.text)
    .concat(q.q);
  // Een gestelde vraag komt niet terug in de chips; wat over is blijft staan,
  // met de doorloopkanalen eronder en één rustige afsluiter.
  const remaining = def.questions
    .map((question, i) => ({ question, i }))
    .filter(({ question }) => asked.indexOf(question.q) === -1)
    .map(({ question, i }) => ({ id: 'q' + i, label: question.q }));
  const followUp = def.followUp
    .map((id) => channelChip(cfg, id))
    .filter((c): c is ThreadChip => c !== null);
  return {
    ...state,
    messages: [
      ...state.messages,
      { from: 'user', text: q.q },
      { from: 'bot', text: q.a, ...(q.button ? { button: q.button } : {}) },
    ],
    chips: [...remaining, ...followUp, { id: 'restart', label: cfg.texts.threadRestart, style: 'quiet' }],
    typing: false,
    entered: false,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- faq threadflow`
Expected: PASS

- [ ] **Step 5: Koppel de FAQ aan de kanalenlijst**

`resolveChannel` krijgt `if (cfg.faqs[id]) return { kind: 'faq', def: cfg.faqs[id] };`. `panelView` toont een faq-kanaal als gewone kanaalknop (`icons[faq.icon]`, titel, sub). In `src/ui/leadbot.ts`:

- de view-union krijgt `'thread'`
- een `thread: ThreadState` naast `form` en `wa`
- de kanaalklik op een faq zet `pushChannelClick(id)`, `thread = openFaq(cfg, def)`, `view = 'thread'`
- `render()` roept `threadView(cfg, thread, { back: !cfg.conversational })` aan
- een klik op `chip-q<N>` doet: `thread = { ...thread, typing: true }`, render, dan na `TYPING_MS` (0 bij `prefers-reduced-motion`) `thread = answerQuestion(...)`, render, en direct daarna `thread.entered = true` zodat een volgende render niets opnieuw afspeelt — hetzelfde patroon als de WhatsApp-flow gebruikt
- een klik op `chip-restart` opent de FAQ opnieuw met `openFaq`
- een klik op `chip-<kanaal>` routeert naar dat kanaal via dezelfde code als een kanaalknop, dus met `pushChannelClick` van dát kanaal

- [ ] **Step 6: Test de doorloop end-to-end**

In `test/leadbot.test.ts`: open de FAQ, klik een vraag, wacht de typ-vertraging af, en controleer dat het antwoord in de DOM staat; klik daarna de WhatsApp-chip en controleer dat er een `channel_click` met `channel: "whatsapp"` in de dataLayer staat en dat de WhatsApp-view opent.

- [ ] **Step 7: Run the full suite**

Run: `npm test && npx tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add src/faq.ts src/ui/threadflow.ts src/config.ts src/channels.ts src/ui/ test/
git commit -m "faqs-kanaal met vraag-en-antwoord in de thread en doorloop naar andere kanalen"
```

---

### Task 7: Gespreksmodus

**Files:**
- Modify: `src/config.ts`, `src/ui/leadbot.ts`, `src/ui/thread.ts`, `src/ui/styles.ts`
- Test: `test/leadbot.test.ts`, `test/config.test.ts`

**Interfaces:**
- Consumes: alles uit Taak 4 t/m 6
- Produces: `cfg.conversational: boolean` (default `false`)

**Ontwerpbeslissing:** de demo legt formulieren als `.ltb-layer` óver de thread, maar die laag bedekt het paneel volledig. Een view-swap met een terugknop ziet er voor de bezoeker hetzelfde uit en past bij de bestaande renderer, die altijd precies één view tekent. We houden dus de view-union aan en onthouden met `returnTo` waar `back` naartoe gaat. Geen `.ltb-layer`, geen `.ltb-panel--tall`.

- [ ] **Step 1: Write the failing test**

In `test/leadbot.test.ts`:

```typescript
it('opens straight into a conversation when conversational is on', () => {
  const cfg = resolveConfig('p1', {
    conversational: true,
    agentName: 'Ronald',
    whatsapp: '+31612345678',
    channels: ['whatsapp', 'contact_form'],
  });
  mountLeadBot(cfg);
  const root = document.getElementById('lt-leadbot-host')!.shadowRoot!;
  (root.querySelector('[data-action="open"]') as HTMLElement).click();
  expect(root.querySelector('.ltb-thread')).not.toBeNull();
  expect(root.querySelector('.ltb-channels')).toBeNull();
  expect(root.querySelector('[data-action="chip-whatsapp"]')).not.toBeNull();
  expect(root.querySelector('[data-action="chip-contact_form"]')).not.toBeNull();
});

it('returns from a form to the conversation, not to a channel list', () => {
  // conversational: true, open contact_form via de chip, klik back
  expect(root.querySelector('.ltb-thread')).not.toBeNull();
  expect(root.querySelector('.ltb-channels')).toBeNull();
});

it('keeps the channel list when conversational is off', () => {
  const cfg = resolveConfig('p1', { whatsapp: '+31612345678', channels: ['whatsapp'] });
  mountLeadBot(cfg);
  // ...
  expect(root.querySelector('.ltb-channels')).not.toBeNull();
  expect(root.querySelector('.ltb-thread')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- leadbot`
Expected: FAIL — `conversational` bestaat niet, `open()` toont altijd het paneel.

- [ ] **Step 3: Write minimal implementation**

In `src/config.ts`: `conversational: boolean` op `LeadBotConfig` en `conversational: u.conversational === true,` in de return.

In `src/ui/leadbot.ts`:

```typescript
  // In gespreksmodus is de thread de ingang; de kanalen zijn dan chips in het
  // gesprek in plaats van knoppen in een lijst.
  function menuThread(): ThreadState {
    return {
      channel: null,
      messages: [{ from: 'bot', text: cfg.greeting }],
      chips: cfg.channels
        .map((id) => channelChip(cfg, id))
        .filter((c): c is ThreadChip => c !== null)
        .map((c) => (c.id === 'whatsapp' ? { ...c, style: 'featured' as const } : c)),
      typing: false,
      entered: false,
    };
  }

  function open(): void {
    view = cfg.conversational ? 'thread' : 'panel';
    if (cfg.conversational) thread = menuThread();
    openedAt = Date.now();
    pushOpen();
    render();
  }
```

`channelChip` verhuist daarvoor van `threadflow.ts` naar een export, zodat beide plekken dezelfde chip-labels gebruiken.

`back` gaat naar de plek waar je vandaan kwam:

```typescript
      case 'back':
        view = returnTo;     // 'panel' of 'thread'
        ...
```

waarbij `returnTo` gezet wordt op `cfg.conversational ? 'thread' : 'panel'` op het moment dat een formulier of de WhatsApp-flow geopend wordt. Bij het terugkeren uit een formulier in gespreksmodus blijft `thread` staan zoals hij was, dus het gesprek gaat verder waar het gebleven was.

Het telefoonkanaal is in gespreksmodus een chip die dezelfde meting doet als de kanaalknop (`pushChannelClick('phone')`, plus `pushConversion('phone', {})` als er géén call tracking is) en daarna `location.href = 'tel:…'` zet.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- leadbot`
Expected: PASS

- [ ] **Step 5: Differentiële test tegen v1.11.0**

Zet een kopie van de vorige versie neer en vergelijk, dezelfde opzet als bij de v1.11.0-release:

```bash
rm -rf .regression-baseline && mkdir -p .regression-baseline
git archive v1.11.0 src | tar -x -C .regression-baseline
echo ".regression-baseline/" >> .git/info/exclude
```

`test/tmp-regression.test.ts` importeert `resolveConfig` uit beide en controleert dat een config zonder `conversational`, `links` en `faqs` identiek resolvet — met minimaal de live configs van een klant met call tracking en een interceptor-only klant, over `nl`, `en` en `de`. Ná afloop van deze taak weer verwijderen; een baseline en een tijdelijke test horen niet in de repo.

- [ ] **Step 6: Run the full suite**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: groen, en let op de bundlegrootte in de build-uitvoer: boven ~24 KB gzip is het tijd om te kijken wat er zo groot is.

- [ ] **Step 7: Commit**

```bash
rm -rf .regression-baseline test/tmp-regression.test.ts
sed -i '' '/regression-baseline/d' .git/info/exclude
git add src/ test/
git commit -m "conversational: de launcher opent een gesprek in plaats van een kanalenlijst"
```

---

### Task 8: Documentatie en release

**Files:**
- Modify: `README.md`, `demo/index.html`
- Extern: `leadtrackr/docs` (Mintlify)

- [ ] **Step 1: README**

Nieuwe rijen in de configuratietabel: `conversational` (default `false`), `links` (`{}`), `faqs` (`{}`). Nieuwe secties "Gespreksmodus", "Infokaarten" en "Veelgestelde vragen", elk met een werkend configvoorbeeld in de stijl van de bestaande "Formulieren"-sectie. In de sectie Formulieren de drie nieuwe veldtypes documenteren, inclusief dat een optie een stabiele `value` naast een vertaalbaar `label` heeft en waarom. In "Meertalige sites" één zin dat opties samenvoegen op `value`.

- [ ] **Step 2: Demo bijwerken**

`demo/index.html` krijgt `?conversational=1` als schakelaar en een voorbeeld-`links` en `faqs`, zodat de modus zonder klantconfig te bekijken is. Geen klantnamen of klantkleuren in de demo.

- [ ] **Step 3: Handmatig nalopen in de browser**

`npm run dev`, dan op `http://localhost:4173/`:
- lijstmodus: het paneel ziet eruit als voorheen, een infokaart-kanaal linkt door, de FAQ opent de thread
- `?conversational=1`: de launcher opent het gesprek, WhatsApp staat als uitgelichte chip bovenaan, een formulier opent en `terug` komt in hetzelfde gesprek uit
- `?lang=de`: alle nieuwe teksten zijn Duits
- toetsenbord: Tab loopt door de chips, Escape sluit, focus komt in de nieuwe views terecht

- [ ] **Step 4: Release**

```bash
npm version minor --no-git-tag-version   # 1.12.0
npm run build
git add -A && git commit -m "Release 1.12.0 — gespreksmodus, infokaarten, FAQ en drie veldtypes"
git checkout main && git merge --ff-only feat/conversational-leadbot
git tag v1.12.0 && git push origin main && git push origin v1.12.0
```

Wacht op een groene CI-run (`gh run list --limit 1`) vóór de purge — een purge duwt de bundel naar álle `@1`-klanten:

```bash
curl https://purge.jsdelivr.net/gh/leadtrackr/leadtrackr-leadbot@1/dist/lt-leadbot.min.js
```

- [ ] **Step 5: Docs-PR**

PR op `leadtrackr/docs` met dezelfde drie secties plus een changelog-entry voor 1.12.0.

- [ ] **Step 6: Van Delft-tag omzetten**

In `~/Documents/ywt-voorstellen/van-delft/gtm-leadbot-tag.html`: `conversational: true`, de kanalen `winkels`, `vacatures` en `faq` toevoegen met hun teksten uit het voorstel, en in het offerteformulier `aantal` naar `number` met `min: 1`, `leverdatum` naar `date` en `opties` naar een keuzegroep — de tekstveld-omweg vervalt. Duitse tegenhangers in de `byLanguage.de`-laag.

## Zelfcontrole op dit plan

- **Spec-dekking:** gespreksmodus (7), `links` (4), `faqs` (6), thread (5), richtext (3), veldtypes (1, 2), dataLayer ongewijzigd (4, 6), toegankelijkheid (5, 8), terugwaartse compatibiliteit (7), tests (elke taak), release (8). Het enige spec-onderdeel zonder eigen taak is de CSS-port, die bewust in Taak 5 zit bij de component die hem nodig heeft.
- **Afwijking van de spec:** de spec noemt `.ltb-layer` en `.ltb-panel--tall` uit de demo; Taak 7 kiest voor een view-swap met `returnTo` omdat de laag het paneel toch volledig bedekt en de renderer altijd één view tekent. Zelfde beeld, minder machinerie.
- **Namen die over taken heen lopen:** `ThreadState`, `ThreadChip`, `ThreadMessage` (5) → gebruikt in 6 en 7; `resolveChannel` (4) → 6 en 7; `channelChip` (6) → verhuist in 7 naar een gedeelde export; `renderText` (3) → 5.
