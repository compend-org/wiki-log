// ABOUTME: Tests that DOM inserts and removals survive nodes a page translator has moved.
// ABOUTME: Uses a small stand-in for DOM nodes, since the tests run without a browser.
import assert from "node:assert/strict";
import { test } from "node:test";
import { tolerateTranslatedPage } from "./translatedPage";

type FakeNode = { parentNode: FakeNode | null; children: FakeNode[] };

// A stand-in for Node.prototype whose methods throw like the browser's do
function fakePrototype() {
  return {
    insertBefore(this: FakeNode, node: FakeNode, before: FakeNode | null) {
      if (before && before.parentNode !== this) throw new Error("NotFound");
      const at = before ? this.children.indexOf(before) : this.children.length;
      this.children.splice(at, 0, node);
      node.parentNode = this;
      return node;
    },
    removeChild(this: FakeNode, child: FakeNode) {
      if (child.parentNode !== this) throw new Error("NotFound");
      this.children.splice(this.children.indexOf(child), 1);
      child.parentNode = null;
      return child;
    },
  };
}

function node(parent: FakeNode | null = null): FakeNode {
  const n: FakeNode = { parentNode: parent, children: [] };
  parent?.children.push(n);
  return n;
}

test("inserts before a node that is still a child", () => {
  const proto = fakePrototype();
  tolerateTranslatedPage(proto);
  const parent = node();
  const first = node(parent);
  const added = node();
  proto.insertBefore.call(parent, added, first);
  assert.deepEqual(parent.children, [added, first]);
});

test("appends when the node to insert before was moved away", () => {
  const proto = fakePrototype();
  tolerateTranslatedPage(proto);
  const parent = node();
  const kept = node(parent);
  const moved = node(node());
  const added = node();
  proto.insertBefore.call(parent, added, moved);
  assert.deepEqual(parent.children, [kept, added]);
});

test("removes a node that is still a child", () => {
  const proto = fakePrototype();
  tolerateTranslatedPage(proto);
  const parent = node();
  const child = node(parent);
  proto.removeChild.call(parent, child);
  assert.deepEqual(parent.children, []);
});

test("leaves a node that was moved away where it is", () => {
  const proto = fakePrototype();
  tolerateTranslatedPage(proto);
  const parent = node();
  const elsewhere = node();
  const moved = node(elsewhere);
  assert.equal(proto.removeChild.call(parent, moved), moved);
  assert.deepEqual(elsewhere.children, [moved]);
});
