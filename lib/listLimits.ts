// ABOUTME: Size limits for lists, matching the database's backstop trigger.
// ABOUTME: Shared by the server actions and the list pickers in the browser.

// Mirrors limit_list_counts() in supabase/migrations/*_raise_list_limits.sql
export const MAX_LIST_ITEMS = 10000;

// Up to this many items, the "Add to list" picker shows every item to drag
// the new one into place; past it, people type the rank instead.
export const MAX_DRAG_PLACE_ITEMS = 100;
