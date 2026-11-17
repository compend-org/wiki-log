// ABOUTME: Picks which time a list card shows: when the list was made, or when it was last added to.
// ABOUTME: Only an activity feed, which orders lists by their latest addition, shows the latter.

type ListTimes = {
  created_at: string;
  last_bumped_at?: string | null;
  activity_at?: string | null;
};

// Whether the card should say the list was added to, and when. A row whose
// query left out the bump columns counts as never added to, so it still shows
// a real date rather than an invalid one.
export function listCardTime(
  list: ListTimes,
  showActivity: boolean,
): { bumped: boolean; time: string } {
  if (showActivity && list.last_bumped_at != null && list.activity_at != null) {
    return { bumped: true, time: list.activity_at };
  }
  return { bumped: false, time: list.created_at };
}
