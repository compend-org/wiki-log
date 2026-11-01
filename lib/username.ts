export const NAME_RULES =
  "2–30 characters: letters, numbers, spaces and . _ ' -";

const ALLOWED = /^[\p{L}\p{N}][\p{L}\p{N} ._'’-]*$/u;

// Trims and collapses repeated spaces
export function cleanName(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

export function isValidName(name: string): boolean {
  const length = [...name].length;
  return length >= 2 && length <= 30 && ALLOWED.test(name);
}

// In SQL patterns, % and _ are wildcards, so escape them
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&");
}