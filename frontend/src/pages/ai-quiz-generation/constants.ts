/** Max questions per AI generation (UI + localStorage draft). */
export const MAX_QUESTION_COUNT = 50;

/** Question count is chosen in steps of 5 (5, 10, …, 50). */
export const QUESTION_COUNT_STEP = 5;

export const QUESTION_COUNT_CHOICES: readonly number[] = Array.from(
  { length: MAX_QUESTION_COUNT / QUESTION_COUNT_STEP },
  (_, i) => (i + 1) * QUESTION_COUNT_STEP,
);

/** Max prepared material files per generation session. */
export const MAX_PREPARED_MATERIALS = 3;

/** Snap to nearest step between 5 and 50 (for legacy or API values). */
export function normalizeQuestionCount(value: number): number {
  const n = Math.floor(Math.abs(value));
  if (Number.isNaN(n) || n === 0) return 10;
  const rounded = Math.round(n / QUESTION_COUNT_STEP) * QUESTION_COUNT_STEP;
  return Math.min(
    MAX_QUESTION_COUNT,
    Math.max(QUESTION_COUNT_STEP, rounded),
  );
}
