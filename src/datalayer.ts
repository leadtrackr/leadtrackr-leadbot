import { splitName } from './payload';
import type { ChannelId } from './types';

function push(data: Record<string, unknown>): void {
  const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
  (w.dataLayer = w.dataLayer || []).push(data);
}

export function pushOpen(): void {
  push({ event: 'leadtrackr_leadbot_open' });
}

export function pushChannelClick(channel: ChannelId): void {
  push({ event: 'leadtrackr_leadbot_channel_click', channel });
}

export function pushConversion(
  channel: ChannelId,
  fields: { name?: string; email?: string; phone?: string },
): void {
  const userData: Record<string, string> = {};
  if (fields.phone) userData.phone_number = fields.phone;
  if (fields.email) userData.email_address = fields.email;
  const { firstName, lastName } = splitName(fields.name || '');
  if (firstName) userData.first_name = firstName;
  if (lastName) userData.last_name = lastName;
  push({ event: 'leadtrackr_leadbot_conversion', channel, user_data: userData });
}
