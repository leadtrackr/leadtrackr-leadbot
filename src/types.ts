// Compact keys, matching what the GTM tag writes: both write the same cookie,
// so the format has to be identical or they overwrite each other's journeys.
// The LeadTrackr backend expands these on intake.
export interface Channel {
  s: string;
  m: string;
  cm?: string;
  ct?: string;
  tm?: string;
}

export interface ChannelFlowEntry {
  t: number;
  ch: Channel;
  /** Landing path of this session, without query string. */
  lp?: string;
}

export type ConsentState = 'granted' | 'denied';

/** Partial on purpose: a type we cannot determine is left out, never guessed. */
export type Consent = Partial<
  Record<'ad_storage' | 'analytics_storage' | 'ad_user_data' | 'ad_personalization', ConsentState>
>;

export interface AttributionData {
  fbc: string;
  fbp: string;
  gclid: string;
  wbraid: string;
  gbraid: string;
  dclid: string;
  msclkid: string;
  /** Microsoft's browser ID, its equivalent of fbp. */
  uetvid: string;
  ttclid: string;
  ttp: string;
  li_fat_id: string;
  scclid: string;
  scid: string;
  rdt_cid: string;
  rdt_uuid: string;
  epik: string;
  twclid: string;
  oppref: string;
  obref: string;
  cid: string;
  /** Host and path of the page the conversion happened on, without query string. */
  conversionPage: string;
  /** Consent Mode state at conversion. Absent when it cannot be determined. */
  consent?: Consent;
}

export interface LeadUserData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

export interface LeadPayload {
  projectId: string;
  formData: {
    formName: string;
    uniqueEventId: string;
    formFields: Record<string, string>;
  };
  userData: LeadUserData;
  channelFlow?: ChannelFlowEntry[];
  attributionData: AttributionData;
}

export type ChannelId = 'contact_form' | 'phone' | 'whatsapp';
