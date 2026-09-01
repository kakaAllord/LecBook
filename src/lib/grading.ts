/**
 * How a student's standing is worked out.
 *
 * Each assessment is marked out of its own total — a quiz out of 20 and an exam
 * out of 100 are both scored in full, and neither eats into a shared allowance
 * for the module. The standing is then the average of the percentages scored,
 * so every assessment carries the same weight regardless of what it was marked
 * out of, and passing means that average reaching the pass mark.
 *
 * An assessment nobody has marked yet is left out of the average rather than
 * counted as a zero: a module half way through its marking should not read as a
 * failure for everyone in it.
 */

export type ScoredAssessment = { marks: number | null; maxMarks: number };

export type Standing = {
  /** Mean of the percentages scored, 0 when nothing is marked. */
  average: number;
  /** How many of the assessments actually carry a mark. */
  graded: number;
  /** How many assessments were in scope, marked or not. */
  total: number;
};

/** One assessment's score as a percentage of what it was marked out of. */
export function scorePercentage(marks: number, maxMarks: number) {
  return maxMarks > 0 ? (marks / maxMarks) * 100 : 0;
}

export function computeStanding(items: ScoredAssessment[]): Standing {
  const scored = items.filter(
    (item): item is { marks: number; maxMarks: number } => item.marks !== null && item.maxMarks > 0
  );
  const average =
    scored.length > 0
      ? scored.reduce((sum, item) => sum + scorePercentage(item.marks, item.maxMarks), 0) / scored.length
      : 0;
  return { average, graded: scored.length, total: items.length };
}

/**
 * A verdict is only given once something has been marked — calling a student
 * with no marks a "FAIL" reads as a failing grade they never sat.
 */
export function passes(standing: Standing, passMark: number) {
  return standing.graded > 0 && standing.average >= passMark;
}

/** One decimal place, which is as much precision as a mark sheet needs. */
export function roundPercentage(value: number) {
  return Math.round(value * 10) / 10;
}
