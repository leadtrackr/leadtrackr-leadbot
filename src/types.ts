export interface Channel {
  source: string;
  medium: string;
  campaign?: string;
  content?: string;
  term?: string;
}

export interface ChannelFlowEntry {
  timestamp: number;
  channel: Channel;
}

export interface AttributionData {
  fbc: string;
  fbp: string;
  gclid: string;
  wbraid: string;
  cid: string;
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

export type ChannelId = 'message' | 'call' | 'whatsapp';
