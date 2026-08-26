import { collectAttributionFromPage } from './attribution';
import { readChannelFlow } from './channelflow';
import type { LeadBotConfig } from './config';
import { isReservedKey } from './forms';
import type { LeadPayload, LeadUserData } from './types';

export function splitName(full: string): { firstName?: string; lastName?: string } {
  const trimmed = full.trim();
  if (!trimmed) return {};
  const space = trimmed.indexOf(' ');
  if (space === -1) return { firstName: trimmed };
  return { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1) };
}

/**
 * Ruwe formulierwaarden op veld-key. De gereserveerde keys (zie forms.ts)
 * worden er hier uitgehaald voor userData; al het andere gaat als vrij veld
 * mee in formFields.
 */
export type LeadFields = Record<string, string | undefined>;

export function buildLeadPayload(
  cfg: LeadBotConfig,
  formName: string,
  fields: LeadFields,
): LeadPayload {
  const value = (key: string): string => (fields[key] || '').trim();
  const userData: LeadUserData = { ...splitName(value('name')) };
  if (value('email')) userData.email = value('email');
  if (value('phone')) userData.phone = value('phone');

  const formFields: Record<string, string> = {};
  if (value('message')) formFields.message = value('message');
  for (const key of Object.keys(fields)) {
    if (isReservedKey(key)) continue;
    if (value(key)) formFields[key] = value(key);
  }
  formFields.page_url = location.href;
  formFields.page_title = document.title;

  const payload: LeadPayload = {
    projectId: cfg.projectId,
    formData: {
      formName,
      uniqueEventId: 'ltb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      formFields,
    },
    userData,
    attributionData: collectAttributionFromPage(),
  };
  const flow = readChannelFlow();
  if (flow.length) payload.channelFlow = flow;
  return payload;
}
