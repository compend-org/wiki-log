export const PAGE_SIZE = 30;

export function parseLimit(value: string | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return PAGE_SIZE;
  return Math.min(Math.max(Math.floor(n), PAGE_SIZE), 300);
}