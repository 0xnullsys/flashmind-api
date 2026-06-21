/**
 * Character-counting utilities + card limits.
 * ponytail: simple .length; counts every character (incl. spaces, punctuation, CJK).
 */

export const MAX_FRONT_CHARS = 120;
export const MAX_BACK_CHARS = 500;

export function countChars(text: string): number {
  if (!text) return 0;
  // ponytail: use Array.from to count Unicode code points correctly (handles surrogate pairs)
  return Array.from(text).length;
}

export interface CharLimitResult {
  ok: boolean;
  count: number;
  max: number;
}

export function checkFrontLimit(text: string): CharLimitResult {
  const count = countChars(text);
  return { ok: count <= MAX_FRONT_CHARS, count, max: MAX_FRONT_CHARS };
}

export function checkBackLimit(text: string): CharLimitResult {
  const count = countChars(text);
  return { ok: count <= MAX_BACK_CHARS, count, max: MAX_BACK_CHARS };
}
