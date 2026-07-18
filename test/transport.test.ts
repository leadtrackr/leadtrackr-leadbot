import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendLead } from '../src/transport';
import type { LeadPayload } from '../src/types';

const payload: LeadPayload = {
  projectId: 'p',
  formData: { formName: 'f', uniqueEventId: 'id', formFields: {} },
  userData: { email: 'a@b.nl' },
  attributionData: { fbc: '', fbp: '', gclid: '', wbraid: '', cid: '' },
};

afterEach(() => vi.unstubAllGlobals());

describe('sendLead', () => {
  it('POSTs JSON and resolves true on ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await expect(sendLead(payload, 'https://x/lead')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('https://x/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  });

  it('resolves false on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422 }));
    await expect(sendLead(payload, 'https://x/lead')).resolves.toBe(false);
  });

  it('resolves false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    await expect(sendLead(payload, 'https://x/lead')).resolves.toBe(false);
  });
});
