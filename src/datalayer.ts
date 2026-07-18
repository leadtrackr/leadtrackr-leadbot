import { collectAttributionFromPage } from './attribution';
import { readChannelFlow } from './channelflow';
import type { WidgetConfig } from './config';
import { splitName } from './payload';
import type { ChannelId } from './types';

declare const LT_WIDGET_VERSION: string;

function push(data: Record<string, unknown>): void {
  const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
  (w.dataLayer = w.dataLayer || []).push(data);
}

function base(cfg: WidgetConfig): Record<string, unknown> {
  return { project_id: cfg.projectId, widget_version: LT_WIDGET_VERSION };
}

function attributionSnapshot(): Record<string, string> {
  const flow = readChannelFlow();
  const channel = flow.length ? flow[flow.length - 1].channel : { source: '', medium: '' };
  const attr = collectAttributionFromPage();
  return {
    source: channel.source || '',
    medium: channel.medium || '',
    campaign: (channel as { campaign?: string }).campaign || '',
    gclid: attr.gclid,
    wbraid: attr.wbraid,
    fbclid: new URLSearchParams(location.search).get('fbclid') || '',
    ga_client_id: attr.cid,
  };
}

export function pushOpen(cfg: WidgetConfig): void {
  push({ event: 'leadtrackr_widget_open', leadtrackr: base(cfg) });
}

export function pushChannelClick(cfg: WidgetConfig, channel: ChannelId): void {
  push({ event: 'leadtrackr_widget_channel_click', leadtrackr: { ...base(cfg), channel } });
}

export function pushCallClick(cfg: WidgetConfig): void {
  push({
    event: 'leadtrackr_widget_call_click',
    leadtrackr: { ...base(cfg), channel: 'call', phone_number: cfg.phone },
  });
}

export function pushLeadSubmitted(
  cfg: WidgetConfig,
  channel: 'message' | 'whatsapp',
  fields: { name?: string; email?: string; phone?: string },
): void {
  const upd: Record<string, unknown> = {};
  if (fields.email) upd.email = fields.email;
  if (fields.phone) upd.phone_number = fields.phone;
  const { firstName, lastName } = splitName(fields.name || '');
  if (firstName || lastName) upd.address = [{ first_name: firstName || '', last_name: lastName || '' }];
  push({
    event: 'leadtrackr_widget_lead_submitted',
    leadtrackr: {
      ...base(cfg),
      channel,
      form_name: cfg.formNames[channel],
      attribution: attributionSnapshot(),
    },
    user_provided_data: upd,
  });
}
