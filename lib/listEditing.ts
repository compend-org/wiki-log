// ABOUTME: Keeps a saved list's editor page in step with the database, one change at a time.
// ABOUTME: Changes and page loads queue up and read the page and count as they are when they run.
import { LIST_PAGE_SIZE, pageCount, pageOfRank } from "@/lib/listPages";

export type EditorEntry = {
  itemId: string;
  title: string;
  imageUrl: string | null;
};

// What the editor shows. `busy` is true while anything is queued or running.
export type EditorSnapshot = {
  items: EditorEntry[];
  page: number;
  total: number;
  busy: boolean;
  error: string;
  // Says where an item went when that's on another page
  notice: { text: string; page: number } | null;
};

// The requests the editor makes. A resolved { error } is a refusal; a
// rejection (say, the network is down) is handled as well.
export type EditorRequests = {
  fetchPage(
    page: number,
  ): Promise<{ entries: EditorEntry[]; total: number; error?: string }>;
  move(itemId: string, position: number): Promise<{ error?: string }>;
  remove(itemId: string): Promise<{ error?: string }>;
  add(itemId: string): Promise<{ error?: string; item?: EditorEntry }>;
  // The page now on screen, to keep it in the address
  pageShown?(page: number): void;
};

export const UNREACHABLE = "Couldn't reach the server. Please try again.";

function rankText(rank: number): string {
  return `#${rank.toLocaleString("en-US")}`;
}

export class SavedListEditing {
  private state: EditorSnapshot;
  private pending = 0;
  private tail: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly requests: EditorRequests,
    initial: { items: EditorEntry[]; page: number; total: number },
    private readonly onChange: (snapshot: EditorSnapshot) => void,
  ) {
    this.state = { ...initial, busy: false, error: "", notice: null };
  }

  get snapshot(): EditorSnapshot {
    return this.state;
  }

  private set(change: Partial<EditorSnapshot>) {
    this.state = { ...this.state, ...change };
    this.onChange(this.state);
  }

  private get offset(): number {
    return (this.state.page - 1) * LIST_PAGE_SIZE;
  }

  // Runs `task` once everything queued before it has finished, so it sees the
  // page and count those left behind. The editor is busy until the queue is
  // empty, whether each task succeeds, fails or rejects.
  private run<T>(task: () => Promise<T>): Promise<T> {
    this.pending += 1;
    if (this.pending === 1) this.set({ busy: true });
    const result = this.tail.then(task);
    this.tail = result.catch(() => undefined);
    return result.finally(() => {
      this.pending -= 1;
      if (this.pending === 0) this.set({ busy: false });
    });
  }

  // Shows `wanted`, or the list's last page if it has got shorter than that
  private async load(wanted: number): Promise<void> {
    const result = await this.requests.fetchPage(wanted);
    if (result.error) {
      this.set({ error: result.error });
      return;
    }
    const last = pageCount(result.total);
    if (wanted > last) {
      await this.load(last);
      return;
    }
    this.set({ items: result.entries, total: result.total, page: wanted });
    this.requests.pageShown?.(wanted);
  }

  goToPage(wanted: number): Promise<void> {
    this.set({ error: "", notice: null });
    return this.run(async () => {
      try {
        await this.load(wanted);
      } catch {
        this.set({ error: UNREACHABLE });
      }
    });
  }

  // A drag within the page on screen. It shows at once, and is ignored while
  // anything else is going on, since the tiles are about to change.
  drag(itemId: string, overId: string): Promise<boolean> {
    if (this.pending > 0) return Promise.resolve(false);
    const previous = this.state.items;
    const from = previous.findIndex((i) => i.itemId === itemId);
    const to = previous.findIndex((i) => i.itemId === overId);
    if (from < 0 || to < 0 || from === to) return Promise.resolve(false);

    const next = [...previous];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    const position = this.offset + to + 1;
    this.set({ items: next, error: "", notice: null });

    return this.run(async () => {
      let error: string | undefined;
      try {
        ({ error } = await this.requests.move(itemId, position));
      } catch {
        error = UNREACHABLE;
      }
      if (error) {
        // Nothing else could start meanwhile, so this page is still on screen
        this.set({ items: previous, error });
        return false;
      }
      return true;
    });
  }

  // Moves an item to any position in the list, including on other pages
  moveTo(itemId: string, title: string, rank: number): Promise<boolean> {
    this.set({ error: "", notice: null });
    return this.run(async () => {
      const { total, page } = this.state;
      if (!Number.isInteger(rank) || rank < 1 || rank > total) {
        this.set({
          error: `Pick a position from 1 to ${total.toLocaleString("en-US")}.`,
        });
        return false;
      }
      const index = this.state.items.findIndex((i) => i.itemId === itemId);
      if (index >= 0 && this.offset + index + 1 === rank) return false;

      let error: string | undefined;
      try {
        ({ error } = await this.requests.move(itemId, rank));
      } catch {
        error = UNREACHABLE;
      }
      if (error) {
        this.set({ error });
        return false;
      }
      const target = pageOfRank(rank);
      this.set({
        notice:
          target === page
            ? null
            : {
                text: `Moved “${title}” to ${rankText(rank)}, on page ${target}.`,
                page: target,
              },
      });
      // Everything between the old and new places shifted by one
      try {
        await this.load(this.state.page);
      } catch {
        this.set({ error: UNREACHABLE });
      }
      return true;
    });
  }

  remove(itemId: string): Promise<boolean> {
    this.set({ error: "", notice: null });
    return this.run(async () => {
      const previous = this.state.items;
      if (!previous.some((i) => i.itemId === itemId)) return false;
      this.set({ items: previous.filter((i) => i.itemId !== itemId) });

      let error: string | undefined;
      try {
        ({ error } = await this.requests.remove(itemId));
      } catch {
        error = UNREACHABLE;
      }
      if (error) {
        this.set({ items: previous, error });
        return false;
      }
      const totalBefore = this.state.total;
      this.set({ total: totalBefore - 1 });
      // The next page's first item moves up onto this one, or, if this page
      // is now empty, the one before is shown
      if (
        this.offset + previous.length < totalBefore ||
        previous.length === 1
      ) {
        try {
          await this.load(this.state.page);
        } catch {
          this.set({ error: UNREACHABLE });
        }
      }
      return true;
    });
  }

  // Adds an item at the end of the list. It goes by the page and count as
  // they are when the item is saved, not when it was picked. A rejection is
  // passed on, so the picker keeps the choice and says it couldn't save it.
  add(itemId: string): Promise<{ added?: EditorEntry; error?: string }> {
    this.set({ error: "", notice: null });
    return this.run(async () => {
      const result = await this.requests.add(itemId);
      if (result.error || !result.item) {
        const error = result.error ?? "Something went wrong.";
        this.set({ error });
        return { error };
      }
      const added = result.item;
      const rank = this.state.total + 1;
      const target = pageOfRank(rank);
      if (target === this.state.page) {
        this.set({ total: rank, items: [...this.state.items, added] });
      } else {
        this.set({
          total: rank,
          notice: {
            text: `Added “${added.title}” at ${rankText(rank)}, on page ${target}.`,
            page: target,
          },
        });
      }
      return { added };
    });
  }

  dismissError() {
    this.set({ error: "" });
  }
}
