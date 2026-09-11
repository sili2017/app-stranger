/** A registered, age-eligible user fixture (ageAssuranceStatus already `liveness_passed`). */
export function eligibleUserFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-fixture-0001',
    ageAssuranceStatus: 'liveness_passed',
    accountStatus: 'active',
    ...overrides,
  };
}
