/**
 * Minimal geohash encoder. Truncated to a fixed 6-character, neighborhood-scale
 * precision (≈ 1.2km × 0.6km cell — contracts/events.md offer.published) so Discovery &
 * Location gets only enough precision for radius bucketing, never the exact point.
 */
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const GEOHASH_PRECISION = 6;

export function encodeGeohash(lat: number, lng: number, precision = GEOHASH_PRECISION): string {
  const latRange: [number, number] = [-90, 90];
  const lngRange: [number, number] = [-180, 180];
  let hash = '';
  let bit = 0;
  let ch = 0;
  let evenBit = true;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (lng >= mid) {
        ch = (ch << 1) | 1;
        lngRange[0] = mid;
      } else {
        ch = ch << 1;
        lngRange[1] = mid;
      }
    } else {
      const mid = (latRange[0] + latRange[1]) / 2;
      if (lat >= mid) {
        ch = (ch << 1) | 1;
        latRange[0] = mid;
      } else {
        ch = ch << 1;
        latRange[1] = mid;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}
