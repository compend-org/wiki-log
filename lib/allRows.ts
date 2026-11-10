// ABOUTME: Reads more rows than one API response carries, a response at a time.
// ABOUTME: The API returns at most 1,000 rows per request, embedded rows included.

// The most rows the API returns for one request (`max_rows` in
// supabase/config.toml, and the same in production). Embedded resources are
// capped at this too.
export const API_MAX_ROWS = 1000;

type RowsResponse = {
  data: unknown[] | null;
  error: { message: string } | null;
};

// Every row a query gives, up to `limit`, asking for them a response at a
// time. `page` builds the query afresh for the zero-based rows `from`..`to`
// (inclusive, as for .range()) and must order them by something unique, so
// responses never overlap or skip a row.
export async function fetchRows<Row>(
  page: (from: number, to: number) => PromiseLike<RowsResponse>,
  limit = Number.POSITIVE_INFINITY,
): Promise<{ rows: Row[]; error?: string }> {
  const rows: Row[] = [];
  while (rows.length < limit) {
    const size = Math.min(API_MAX_ROWS, limit - rows.length);
    const { data, error } = await page(rows.length, rows.length + size - 1);
    if (error) return { rows, error: error.message };
    const got = (data ?? []) as Row[];
    rows.push(...got);
    if (got.length < size) break;
  }
  return { rows };
}

// `values` split into runs of at most `size`, for filters like .in() that put
// every value in the URL
export function chunks<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    out.push(values.slice(i, i + size));
  }
  return out;
}
