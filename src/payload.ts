import { collectAttributionFromPage } from './attribution';
import { readChannelFlow } from './channelflow';
import type { WidgetConfig } from './config';
import type { LeadPayload, LeadUserData } from './types';

export function splitName(full: string): { firstName?: string; lastName?: string } {
  const trimmed = full.trim();
  if (!trimmed) return {};
  const space = trimmed.indexOf(' ');
  if (space === -1) return { firstName: trimmed };
  return { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1) };
}

export interface LeadFields {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
}

export function buildLeadPayload(
  cfg: WidgetConfig,
  channel: 'message' | 'whatsapp',
  fields: LeadFields,
): LeadPayload {
  const userData: LeadUserData = { ...splitName(fields.name || '') };
  if (fields.email) userData.email = fields.email;
  if (fields.phone) userData.phone = fields.phone;

  const formFields: Record<string, string> = {};
  if (fields.message) formFields.message = fields.message;
  formFields.page_url = location.href;
  formFields.page_title = document.title;

  const payload: LeadPayload = {
    projectId: cfg.projectId,
    formData: {
      formName: cfg.formNames[channel],
      uniqueEventId: 'ltw-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      formFields,
    },
    userData,
    attributionData: collectAttributionFromPage(),
  };
  const flow = readChannelFlow();
  if (flow.length) payload.channelFlow = flow;
  return payload;
}
