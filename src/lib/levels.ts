/**
 * Levels of study, shared by the server and the browser.
 *
 * A student is at Level I, II or III, stored as 1–3 and shown in Roman
 * numerals because that is how the college writes them. A related module
 * belongs to one level; a core module is taught at all three, so wherever a
 * module is picked it is picked *at a level* — "Electrical Installation
 * Level I" — and that pair is what registers, assessments and reports hang on.
 */

export const LEVELS = [1, 2, 3] as const;
export type Level = (typeof LEVELS)[number];

export const FIRST_LEVEL: Level = 1;
export const FINAL_LEVEL: Level = 3;

const ROMAN: Record<number, string> = { 1: "I", 2: "II", 3: "III" };

export function romanLevel(level: number) {
  return ROMAN[level] ?? String(level);
}

/** "Level II" */
export function levelLabel(level: number) {
  return `Level ${romanLevel(level)}`;
}

/** "Electrical Installation Level I" — how a module is named wherever it is chosen. */
export function moduleAtLevelLabel(moduleName: string, level: number) {
  return `${moduleName} ${levelLabel(level)}`;
}

export function isLevel(value: unknown): value is Level {
  return typeof value === "number" && (LEVELS as readonly number[]).includes(value);
}

/**
 * The college's year, as the administrator described it. It is guidance for
 * when to run promotions, not something the system acts on by itself.
 */
export const ACADEMIC_CALENDAR = [
  { levels: "Level I and II", runs: "From January", semesters: 2 },
  { levels: "Level III", runs: "June to July the following year", semesters: 2 },
] as const;

/**
 * A module at a level travels through URLs and form values as one string, so a
 * single dropdown can choose both.
 */
export function classKey(moduleId: string, level: number) {
  return `${moduleId}:${level}`;
}

export function parseClassKey(key: string): { moduleId: string; level: Level } | null {
  const index = key.lastIndexOf(":");
  if (index <= 0) return null;
  const moduleId = key.slice(0, index);
  const level = Number(key.slice(index + 1));
  return isLevel(level) ? { moduleId, level } : null;
}

/** The levels a module can be taught at: all three for a core module, its own for a related one. */
export function levelsForModule(module_: { kind: "CORE" | "RELATED"; level: number | null }): Level[] {
  if (module_.kind === "CORE") return [...LEVELS];
  return isLevel(module_.level) ? [module_.level] : [];
}
