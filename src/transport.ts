import type { LeadPayload } from './types';

export interface SendResult {
  ok: boolean;
  /** HTTP-status van de respons; 0 bij netwerkfout. */
  status: number;
}

export async function sendLead(payload: LeadPayload, endpoint: string): Promise<SendResult> {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
