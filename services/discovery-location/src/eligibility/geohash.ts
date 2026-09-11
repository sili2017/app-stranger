/**
 * Decodes a geohash back to its approximate center point. Discovery & Location never
 * receives an offer's exact lat/lng (constitution §3.IV) — only the truncated geohash
 * from offer.published — so eligibility/distance math necessarily uses this
 * cell-center approximation, not the true point. At 6-character precision the cell is
 * roughly 1.2km × 0.6km, well within the smallest confirmed distance band (<1km), which
 * is an accepted approximation for band display, not for anything requiring the exact
 * meeting point (that stays behind the post-selection internal lookup, T081).
 */
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function decodeGeohash(geohash: string): { lat: number; lng: number } {
  let latRange: [number, number] = [-90, 90];
  let lngRange: [number, number] = [-180, 180];
  let evenBit = true;

  for (const char of geohash) {
    const idx = BASE32.indexOf(char);
    for (let bit = 4; bit >= 0; bit--) {
      const bitValue = (idx >> bit) & 1;
      if (evenBit) {
        const mid = (lngRange[0] + lngRange[1]) / 2;
        if (bitValue === 1) lngRange = [mid, lngRange[1]];
        else lngRange = [lngRange[0], mid];
      } else {
        const mid = (latRange[0] + latRange[1]) / 2;
        if (bitValue === 1) latRange = [mid, latRange[1]];
        else latRange = [latRange[0], mid];
      }
      evenBit = !evenBit;
    }
  }

  return {
    lat: (latRange[0] + latRange[1]) / 2,
    lng: (lngRange[0] + lngRange[1]) / 2,
  };
}
