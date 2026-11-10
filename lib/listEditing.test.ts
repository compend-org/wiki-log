// ABOUTME: Tests for editing a saved list a page at a time while requests are slow or fail.
// ABOUTME: Changes must land by the page shown when they run, and never leave the editor stuck.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type EditorEntry,
  type EditorRequests,
  type EditorSnapshot,
  SavedListEditing,
  UNREACHABLE,
} from "./listEditing";
import { LIST_PAGE_SIZE } from "./listPages";

function entry(id: string): EditorEntry {
  return { itemId: id, title: id, imageUrl: null };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Lets every queued promise callback run
const settle = () => new Promise((resolve) => setImmediate(resolve));

type Kind = "fetchPage" | "move" | "remove" | "add";

// A list held in memory, standing in for the database. Any kind of request
// can be held until the test lets it go, or made to fail outright.
function fakeList(count: number) {
  const ids = Array.from({ length: count }, (_, i) => `Q${i + 1}`);
  const held: Partial<Record<Kind, ReturnType<typeof deferred<void>>>> = {};
  const failing = new Set<Kind>();
  const calls: { kind: Kind; args: unknown[] }[] = [];

  async function gate(kind: Kind, args: unknown[]) {
    calls.push({ kind, args });
    const wait = held[kind];
    if (wait) {
      delete held[kind];
      await wait.promise;
    }
    if (failing.has(kind)) {
      failing.delete(kind);
      throw new TypeError("fetch failed");
    }
  }

  const requests: EditorRequests = {
    async fetchPage(page) {
      await gate("fetchPage", [page]);
      const from = (page - 1) * LIST_PAGE_SIZE;
      return {
        entries: ids.slice(from, from + LIST_PAGE_SIZE).map(entry),
        total: ids.length,
      };
    },
    async move(itemId, position) {
      await gate("move", [itemId, position]);
      ids.splice(ids.indexOf(itemId), 1);
      ids.splice(position - 1, 0, itemId);
      return {};
    },
    async remove(itemId) {
      await gate("remove", [itemId]);
      ids.splice(ids.indexOf(itemId), 1);
      return {};
    },
    async add(itemId) {
      await gate("add", [itemId]);
      if (ids.includes(itemId)) {
        return { error: "That item is already in this list." };
      }
      ids.push(itemId);
      return { item: entry(itemId) };
    },
  };

  return {
    ids,
    calls,
    requests,
    hold(kind: Kind) {
      const wait = deferred<void>();
      held[kind] = wait;
      return wait;
    },
    fail(kind: Kind) {
      failing.add(kind);
    },
  };
}

// An editor showing `page` of a list of `count` items
function editorOn(count: number, page: number) {
  const list = fakeList(count);
  const from = (page - 1) * LIST_PAGE_SIZE;
  const busyChanges: boolean[] = [];
  const history: EditorSnapshot[] = [];
  let busy = false;
  const editing = new SavedListEditing(
    list.requests,
    {
      items: list.ids.slice(from, from + LIST_PAGE_SIZE).map(entry),
      page,
      total: count,
    },
    (snapshot) => {
      if (snapshot.busy !== busy) busyChanges.push(snapshot.busy);
      busy = snapshot.busy;
      history.push(snapshot);
    },
  );
  const shown = () => editing.snapshot.items.map((i) => i.itemId);
  return { list, editing, shown, busyChanges, history };
}

test("an item picked before a page change is added by the page shown when it's saved", async () => {
  // Page 2 of 239 is on screen when the item is picked; the picker is still
  // looking it up on Wikipedia when the person goes to page 1
  const { editing, shown } = editorOn(239, 2);
  await editing.goToPage(1);
  assert.equal(editing.snapshot.page, 1);

  // The lookup finishes and the picker hands over the item
  const { added } = await editing.add("Q240");

  assert.equal(added?.itemId, "Q240");
  assert.equal(shown().length, LIST_PAGE_SIZE);
  assert.ok(!shown().includes("Q240"));
  assert.equal(shown()[0], "Q1");
  assert.equal(editing.snapshot.total, 240);
  assert.deepEqual(editing.snapshot.notice, {
    text: "Added “Q240” at #240, on page 2.",
    page: 2,
  });
});

test("an item picked while a page is still loading waits for it, then goes by that page", async () => {
  const { list, editing, shown } = editorOn(239, 2);
  const loading = list.hold("fetchPage");
  const toPageOne = editing.goToPage(1);
  await settle();

  const adding = editing.add("Q240");
  await settle();
  assert.equal(
    list.calls.filter((c) => c.kind === "add").length,
    0,
    "the add waits for the page load",
  );

  loading.resolve();
  await toPageOne;
  await adding;

  assert.equal(editing.snapshot.page, 1);
  assert.ok(!shown().includes("Q240"));
  assert.equal(editing.snapshot.total, 240);
  assert.equal(editing.snapshot.notice?.page, 2);
});

test("a page change asked for while an item is being added waits for the add", async () => {
  const { list, editing, shown, history } = editorOn(239, 2);
  const saving = list.hold("add");
  const adding = editing.add("Q240");
  await settle();
  assert.equal(editing.snapshot.busy, true);

  const toPageOne = editing.goToPage(1);
  await settle();
  assert.equal(
    list.calls.filter((c) => c.kind === "fetchPage").length,
    0,
    "the page load waits for the add",
  );
  saving.resolve();
  await Promise.all([adding, toPageOne]);

  // The add finished on page 2, where the new item belongs, and only then
  // did page 1 load
  const afterAdd = history.find((h) => h.total === 240);
  assert.equal(afterAdd?.page, 2);
  assert.equal(afterAdd?.items.length, LIST_PAGE_SIZE);
  assert.equal(afterAdd?.items.at(-1)?.itemId, "Q240");
  assert.ok(
    history
      .filter((h) => h.page === 1)
      .every((h) => !h.items.some((i) => i.itemId === "Q240")),
  );

  assert.equal(editing.snapshot.page, 1);
  assert.equal(shown()[0], "Q1");
  assert.equal(editing.snapshot.total, 240);
  assert.equal(editing.snapshot.busy, false);
});

test("an add that fails outright frees the editor, keeps the page, and can be tried again", async () => {
  const { list, editing, shown, busyChanges } = editorOn(239, 2);
  const before = shown();
  list.fail("add");

  await assert.rejects(editing.add("Q240"), /fetch failed/);

  assert.equal(editing.snapshot.busy, false);
  assert.deepEqual(busyChanges, [true, false]);
  assert.deepEqual(shown(), before);
  assert.equal(editing.snapshot.total, 239);

  // Paging works again, and so does the retry
  await editing.goToPage(1);
  assert.equal(editing.snapshot.page, 1);
  await editing.goToPage(2);
  const { added } = await editing.add("Q240");
  assert.equal(added?.itemId, "Q240");
  assert.equal(shown().at(-1), "Q240");
  assert.equal(editing.snapshot.total, 240);
  assert.equal(editing.snapshot.busy, false);
});

test("an add the server refuses is reported and changes nothing", async () => {
  const { editing, shown } = editorOn(10, 1);
  const result = await editing.add("Q3");
  assert.equal(result.error, "That item is already in this list.");
  assert.equal(editing.snapshot.error, "That item is already in this list.");
  assert.equal(shown().length, 10);
  assert.equal(editing.snapshot.total, 10);
  assert.equal(editing.snapshot.busy, false);
});

test("a drag saves the item's place in the whole list, not on the page", async () => {
  const { list, editing, shown } = editorOn(300, 2);
  assert.equal(await editing.drag("Q121", "Q123"), true);
  assert.deepEqual(list.calls.at(-1), { kind: "move", args: ["Q121", 123] });
  assert.deepEqual(shown().slice(0, 3), ["Q122", "Q123", "Q121"]);
});

test("a drag that fails outright is undone and frees the editor", async () => {
  const { list, editing, shown } = editorOn(300, 2);
  const before = shown();
  list.fail("move");
  assert.equal(await editing.drag("Q121", "Q123"), false);
  assert.deepEqual(shown(), before);
  assert.equal(editing.snapshot.error, UNREACHABLE);
  assert.equal(editing.snapshot.busy, false);
});

test("a drag while something else is going on is ignored", async () => {
  const { list, editing, shown } = editorOn(300, 2);
  const loading = list.hold("fetchPage");
  const toPageOne = editing.goToPage(1);
  const before = shown();
  assert.equal(await editing.drag("Q121", "Q123"), false);
  assert.deepEqual(shown(), before);
  loading.resolve();
  await toPageOne;
  assert.equal(list.calls.filter((c) => c.kind === "move").length, 0);
});

test("removing an item pulls the next page's first item up", async () => {
  const { editing, shown } = editorOn(300, 1);
  assert.equal(await editing.remove("Q2"), true);
  assert.equal(shown().length, LIST_PAGE_SIZE);
  assert.equal(shown().at(-1), "Q121");
  assert.equal(editing.snapshot.total, 299);
});

test("a remove that fails outright puts the item back and frees the editor", async () => {
  const { list, editing, shown } = editorOn(300, 1);
  const before = shown();
  list.fail("remove");
  assert.equal(await editing.remove("Q2"), false);
  assert.deepEqual(shown(), before);
  assert.equal(editing.snapshot.total, 300);
  assert.equal(editing.snapshot.error, UNREACHABLE);
  assert.equal(editing.snapshot.busy, false);
});

test("removing the only item on the last page shows the page before", async () => {
  const { editing } = editorOn(LIST_PAGE_SIZE + 1, 2);
  await editing.remove(`Q${LIST_PAGE_SIZE + 1}`);
  assert.equal(editing.snapshot.page, 1);
  assert.equal(editing.snapshot.items.length, LIST_PAGE_SIZE);
  assert.equal(editing.snapshot.total, LIST_PAGE_SIZE);
});

test("a move to another page reloads this one and says where the item went", async () => {
  const { editing, shown } = editorOn(300, 2);
  assert.equal(await editing.moveTo("Q130", "Q130", 5), true);
  assert.equal(shown()[0], "Q120");
  assert.ok(!shown().includes("Q130"));
  assert.deepEqual(editing.snapshot.notice, {
    text: "Moved “Q130” to #5, on page 1.",
    page: 1,
  });
});

test("a move checks the position against the list as it is when it runs", async () => {
  const { list, editing } = editorOn(239, 2);
  // An add queued first makes position 240 exist by the time the move runs
  const adding = editing.add("Q240");
  const moving = editing.moveTo("Q121", "Q121", 240);
  await adding;
  assert.equal(await moving, true);
  assert.equal(list.ids.at(-1), "Q121");

  assert.equal(await editing.moveTo("Q122", "Q122", 241), false);
  assert.equal(editing.snapshot.error, "Pick a position from 1 to 240.");
});

test("changes run one at a time, in the order they were made", async () => {
  const { list, editing } = editorOn(300, 1);
  const holdingRemove = list.hold("remove");
  const removing = editing.remove("Q1");
  const adding = editing.add("Q301");
  const moving = editing.moveTo("Q5", "Q5", 2);
  await settle();
  assert.deepEqual(
    list.calls.map((c) => c.kind),
    ["remove"],
  );
  holdingRemove.resolve();
  await Promise.all([removing, adding, moving]);
  assert.deepEqual(
    list.calls.map((c) => c.kind),
    ["remove", "fetchPage", "add", "move", "fetchPage"],
  );
  assert.equal(editing.snapshot.busy, false);
});

test("a page past the end of a list that got shorter shows its last page", async () => {
  const { list, editing } = editorOn(300, 1);
  list.ids.splice(200);
  await editing.goToPage(3);
  assert.equal(editing.snapshot.page, 2);
  assert.equal(editing.snapshot.total, 200);
});

test("an error can be cleared without changing anything else", async () => {
  const { list, editing, shown } = editorOn(300, 1);
  list.fail("remove");
  await editing.remove("Q2");
  assert.equal(editing.snapshot.error, UNREACHABLE);
  const before = shown();
  editing.dismissError();
  assert.equal(editing.snapshot.error, "");
  assert.deepEqual(shown(), before);
  assert.equal(editing.snapshot.busy, false);
});
