export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s,
  );
}

// "Q89" is an item from Wikipedia, "C12" is a compound made on this site
export const ITEM_ID_PATTERN = /^(Q|C)\d+$/;

export function isCompoundId(id: string): boolean {
  return /^C\d+$/.test(id);
}
