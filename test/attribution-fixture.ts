import type { AttributionData } from '../src/types';

/**
 * Every attribution field at its empty value. Tests that assert the whole shape
 * spread this and override what they care about, so adding a channel does not
 * mean editing a literal in three files.
 */
export function emptyAttribution(overrides: Partial<AttributionData> = {}): AttributionData {
  return {
    fbc: '', fbp: '', cid: '', conversionPage: '',
    gclid: '', wbraid: '', gbraid: '', dclid: '',
    msclkid: '', uetvid: '',
    ttclid: '', ttp: '', li_fat_id: '',
    scclid: '', scid: '', rdt_cid: '', rdt_uuid: '',
    epik: '', twclid: '', oppref: '', obref: '',
    ...overrides,
  };
}
