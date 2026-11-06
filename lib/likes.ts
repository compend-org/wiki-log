// Used by "liked these reviews": one person's likes on one item
export function likeKey(userId: string, itemId: string): string {
  return `${userId}:${itemId}`;
}
