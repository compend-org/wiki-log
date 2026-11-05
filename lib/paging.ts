export const PAGE_SIZE = 30;

export function parseLimit(value: string | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return PAGE_SIZE;
  return Math.min(Math.max(Math.floor(n), PAGE_SIZE), 300);
}

// The moment a feed was first loaded. Later pages leave out anything newer, so
// new posts can't push down what someone is reading.
export function parseSnapshot(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? undefined : time.toISOString();
}

export function startOfMinute(time: string): string {
  const minute = new Date(time);
  minute.setUTCSeconds(0, 0);
  return minute.toISOString();
}

export function inIdOrder<Row extends { id: string }>(
  rows: Row[],
  ids: string[],
): Row[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}
