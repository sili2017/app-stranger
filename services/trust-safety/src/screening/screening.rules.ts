/**
 * FR-039: automated keyword/content screening rule set blocking obvious violations of
 * FR-016's prohibited-activity rules (paid meetings, private-home offers,
 * dating/romantic framing, other disallowed activities). Applies to every offer,
 * including high-risk categories — no human-review carve-out in v1 (Clarifications
 * round 5). The exact rule set is still `NEEDS CLARIFICATION` (false-positive/negative
 * handling) — this is a provisional, reviewable starting list, not a final policy.
 */
export const PROHIBITED_KEYWORD_PATTERNS: RegExp[] = [
  // Paid meetings / companionship-for-money framing
  /\bpay\s*(me|her|him|them)\b/i,
  /\bcompensat(ed|ion)\b.*\bmeet/i,
  /\bescort\b/i,
  /\bsugar\s*(daddy|baby|mommy)\b/i,

  // Private-home offers
  /\bmy\s+(house|home|apartment|flat|place)\b/i,
  /\bcome\s+over\b/i,

  // Dating / romantic framing
  /\bdate\b/i,
  /\bromantic\b/i,
  /\bhook\s*up\b/i,
  /\blooking\s+for\s+(love|a\s+relationship)\b/i,
];

export interface ScreeningResult {
  passed: boolean;
  ruleVersion: string;
  matchedPatterns: string[];
  evaluatedAt: string;
}

export const SCREENING_RULE_VERSION = '2026-09-11.1';

export function screenActivityText(activityText: string): ScreeningResult {
  const matched = PROHIBITED_KEYWORD_PATTERNS.filter((pattern) => pattern.test(activityText)).map(
    (pattern) => pattern.source,
  );
  return {
    passed: matched.length === 0,
    ruleVersion: SCREENING_RULE_VERSION,
    matchedPatterns: matched,
    evaluatedAt: new Date().toISOString(),
  };
}
