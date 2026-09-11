/** A minimal valid publish-offer request body, matching contracts/public/offer-service.md. */
export function publishOfferRequestFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    activityText: 'Sunny wants to drink tea',
    place: { kind: 'pin', lat: 18.9398, lng: 72.8355 },
    ...overrides,
  };
}
