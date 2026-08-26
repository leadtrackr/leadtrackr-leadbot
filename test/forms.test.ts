import { describe, expect, it } from 'vitest';
import { normalizeForms, RESERVED_KEYS } from '../src/forms';
import { TEXTS } from '../src/i18n';

const t = TEXTS.nl;
const CONTACT_FORM_NAME = 'LeadBot — Contact form';

function forms(user?: Parameters<typeof normalizeForms>[0]) {
  return normalizeForms(user, t, CONTACT_FORM_NAME);
}

describe('normalizeForms', () => {
  it('yields the built-in contact form when nothing is configured', () => {
    const all = forms(undefined);
    expect(Object.keys(all)).toEqual(['contact_form']);
    const f = all.contact_form;
    expect(f.title).toBe(t.msgTitle);
    expect(f.sub).toBe(t.msgSub);
    expect(f.icon).toBe('chat');
    expect(f.formName).toBe(CONTACT_FORM_NAME);
    expect(f.submit).toBe(t.submit);
    expect(f.fields.map((x) => x.key)).toEqual(['name', 'email', 'message']);
    expect(f.fields.every((x) => x.required)).toBe(true);
    expect(f.fields[2].type).toBe('textarea');
  });

  it('adds a custom form next to the built-in one', () => {
    const all = forms({
      callback: {
        title: 'Bel mij terug',
        fields: [{ key: 'name' }, { key: 'company', label: 'Bedrijfsnaam', required: true }, { key: 'phone' }],
      },
    });
    expect(Object.keys(all).sort()).toEqual(['callback', 'contact_form']);
    expect(all.callback.title).toBe('Bel mij terug');
    expect(all.callback.fields.map((f) => f.key)).toEqual(['name', 'company', 'phone']);
  });

  it('fills reserved keys from the language file so a field can be just its key', () => {
    const [name, email, phone, message] = forms({
      f: { fields: [{ key: 'name' }, { key: 'email' }, { key: 'phone' }, { key: 'message' }] },
    }).f.fields;
    expect(name).toMatchObject({ label: t.nameLabel, type: 'text', placeholder: t.namePlaceholder });
    expect(email).toMatchObject({ label: t.emailLabel, type: 'email' });
    expect(phone).toMatchObject({ label: t.phoneLabel, type: 'tel' });
    expect(message).toMatchObject({ label: t.messageLabel, type: 'textarea' });
  });

  it('defaults an unknown field to an optional text input labelled by its key', () => {
    const [field] = forms({ f: { fields: [{ key: 'company' }] } }).f.fields;
    expect(field).toEqual({ key: 'company', label: 'company', type: 'text', required: false, placeholder: '' });
  });

  it('drops fields without a key and forms without usable fields', () => {
    const all = forms({
      broken: { fields: [{ key: '' } as never] },
      ok: { fields: [{ key: 'name' }] },
    });
    expect(Object.keys(all).sort()).toEqual(['contact_form', 'ok']);
  });

  it('falls back to a text input for an unsupported field type', () => {
    const [field] = forms({ f: { fields: [{ key: 'x', type: 'date' as never }] } }).f.fields;
    expect(field.type).toBe('text');
  });

  it('lets forms.contact_form replace the built-in definition', () => {
    const f = forms({
      contact_form: { title: 'E-mail', formName: 'LeadBot — Contactaanvraag', fields: [{ key: 'email' }] },
    }).contact_form;
    expect(f.title).toBe('E-mail');
    expect(f.formName).toBe('LeadBot — Contactaanvraag');
    expect(f.fields.map((x) => x.key)).toEqual(['email']);
  });

  it('derives a form name from the title when none is given', () => {
    expect(forms({ callback: { title: 'Bel mij terug', fields: [{ key: 'phone' }] } }).callback.formName).toBe(
      'LeadBot — Bel mij terug',
    );
  });

  it('reserves exactly the four keys that carry user data', () => {
    expect([...RESERVED_KEYS]).toEqual(['name', 'email', 'phone', 'message']);
  });
});
