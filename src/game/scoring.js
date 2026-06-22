// Pure, shared helpers used by both the Admin and Display screens.

// Western digits -> Arabic-Indic digits, for scores and the timer.
export function toAr(n) {
  return String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
}

// Parse a string that may contain Arabic-Indic digits back into a number.
export function arNum(str) {
  const normalized = String(str)
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[^0-9]/g, '');
  return parseInt(normalized, 10);
}

// Team accent colours (dots). Extra teams beyond the named four get extras.
export const TEAM_DOTS = [
  '#F5C84B',
  '#E8743B',
  '#6FA8FF',
  '#5FD08A',
  '#C98BFF',
  '#FF6FA8',
  '#4FD6D0',
  '#F2D14B',
];

export const DEFAULT_TEAM_NAMES = [
  'الصقور',
  'النمور',
  'الأسود',
  'الذئاب',
  'الفهود',
  'العقبان',
  'الصحارى',
  'البزاة',
];

export function teamDot(i) {
  return TEAM_DOTS[i % TEAM_DOTS.length];
}

// --- score aggregation off the round log ---
// log entry: { round, pass, teamId, score, outcome, answer }

export function cumTotal(log, teamId) {
  return (log || [])
    .filter((e) => e.teamId === teamId)
    .reduce((a, e) => a + e.score, 0);
}

export function roundTotal(log, teamId, round) {
  return (log || [])
    .filter((e) => e.teamId === teamId && e.round === round)
    .reduce((a, e) => a + e.score, 0);
}

// All reveals in the current round (both passes) — drives the "used answers".
export function usedAnswersThisRound(log, round) {
  return (log || []).filter((e) => e.round === round && e.outcome !== 'wrong');
}

export function activeTeamIds(teams, eliminated) {
  const out = eliminated || [];
  return (teams || []).filter((t) => !out.includes(t.id)).map((t) => t.id);
}
