/**
 * FR-004 (resolved via /speckit-clarify): default eligibility radius is 5 km,
 * configurable per city. No per-city overrides are approved yet, so every city falls
 * back to the default; this map is the extension point once a specific city's radius
 * is approved (research.md §13).
 */
const PER_CITY_RADIUS_KM: Record<string, number> = {};
const DEFAULT_RADIUS_KM = 5;

export function eligibilityRadiusKm(cityId: string): number {
  return PER_CITY_RADIUS_KM[cityId] ?? DEFAULT_RADIUS_KM;
}
