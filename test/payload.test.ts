import { beforeEach, describe, expect, it } from 'vitest';
import { buildLeadPayload, splitName } from '../src/payload';
import { resolveConfig } from '../src/config';
import { updateChannelFlow } from '../src/channelflow';

function clearCookies() {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0];
    if (name) document.cookie = name + '=;max-age=0;path=/';
  }
}

describe('splitName', () => {
  it('splits on the first space', () => {
    expect(splitName('Jan van Jansen')).toEqual({ firstName: 'Jan', lastName: 'van Jansen' });
  });
  it('puts single words in firstName', () => {
    expect(splitName('Jan')).toEqual({ firstName: 'Jan' });
  });
  it('returns empty object for blank input', () => {
    expect(splitName('  ')).toEqual({});
  });
});

describe('buildLeadPayload', () => {
  beforeEach(clearCookies);
  const cfg = resolveConfig('proj-1', { whatsapp: '+31612345678' });

  it('builds the GTM-contract payload for a message lead', () => {
    updateChannelFlow('?utm_source=google&utm_medium=cpc', '', 'klant.nl', 1000);
    const p = buildLeadPayload(cfg, 'message', {
      name: 'Jan Jansen',
      email: 'jan@bedrijf.nl',
      message: 'Hallo!',
    });
    expect(Object.keys(p).sort()).toEqual(['attributionData', 'channelFlow', 'formData', 'projectId', 'userData']);
    expect(p.projectId).toBe('proj-1');
    expect(p.formData.formName).toBe('Widget — Bericht');
    expect(p.formData.uniqueEventId).toMatch(/^ltw-\d+-[a-z0-9]+$/);
    expect(p.formData.formFields.message).toBe('Hallo!');
    expect(typeof p.formData.formFields.page_url).toBe('string');
    expect(p.userData).toEqual({ firstName: 'Jan', lastName: 'Jansen', email: 'jan@bedrijf.nl' });
    expect(p.channelFlow).toHaveLength(1);
    expect(p.attributionData).toEqual({ fbc: '', fbp: '', gclid: '', wbraid: '', cid: '' });
  });

  it('omits channelFlow when the cookie is empty and includes phone for whatsapp leads', () => {
    const p = buildLeadPayload(cfg, 'whatsapp', { phone: '+31612345678', message: 'Vraagje' });
    expect(p.channelFlow).toBeUndefined();
    expect(p.formData.formName).toBe('Widget — WhatsApp');
    expect(p.userData).toEqual({ phone: '+31612345678' });
  });
});
