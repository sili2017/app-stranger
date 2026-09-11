/**
 * FR-018/FR-021: activity text is free-form (no fixed catalog) — these suggestions are
 * optional, non-blocking assistance only. A creator may publish with neither a
 * suggested activity nor a suggested emoji.
 */
export const COMMON_ACTIVITY_SUGGESTIONS: { key: string; label: string; emoji: string }[] = [
  { key: 'tea', label: 'Drink tea', emoji: '\u{1F375}' },
  { key: 'coffee', label: 'Grab coffee', emoji: '\u{2615}' },
  { key: 'walk', label: 'Go for a walk', emoji: '\u{1F6B6}' },
  { key: 'board_games', label: 'Play board games', emoji: '\u{1F3B2}' },
  { key: 'photography', label: 'Photo walk', emoji: '\u{1F4F7}' },
];

export function findSuggestion(key: string | undefined) {
  if (!key) return undefined;
  return COMMON_ACTIVITY_SUGGESTIONS.find((s) => s.key === key);
}
