/**
 * The signed internal principal the gateway forwards to domain services after
 * validating the caller's bearer token (contracts/api-standards.md §Authentication &
 * Authorization: "the gateway forwards a verified, signed internal principal ... a
 * domain service never re-validates the raw client token, but always re-checks
 * authorization for the specific resource itself").
 */
export interface VerifiedPrincipal {
  userId: string;
  ageAssuranceStatus: string;
  roles: string[];
}
