import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendLead } from '../src/transport';
import type { LeadPayload } from '../src/types';
import { emptyAttribution } from './attribution-fixture';

const payload: LeadPayload = {
  projectId: 'p',
  formData: { formName: 'f', uniqueEventId: 'id', formFields: {} },
  userData: { email: 'a@b.nl' },
  attributionData: emptyAttribution(),
};

afterEach(() => vi.unstubAllGlobals());

describe('sendLead', () => {
  it('POSTs JSON and resolves ok with status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await expect(sendLead(payload, 'https://x/lead')).resolves.toEqual({ ok: true, status: 200 });
    expect(fetchMock).toHaveBeenCalledWith('https://x/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  });

  it('resolves not-ok with status on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422 }));
    await expect(sendLead(payload, 'https://x/lead')).resolves.toEqual({ ok: false, status: 422 });
  });

  it('resolves status 0 on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    await expect(sendLead(payload, 'https://x/lead')).resolves.toEqual({ ok: false, status: 0 });
  });
});
