// ABOUTME: Keeps React working after a browser translator rewrites the page's text.
// ABOUTME: Inserts and removals that refer to nodes the translator moved no longer throw.

type NodeMethods = {
  insertBefore(this: unknown, node: never, before: never): unknown;
  removeChild(this: unknown, child: never): unknown;
};

type ChildNode = { parentNode: unknown };

// Translators such as Chrome's swap text nodes for their own <font> elements,
// so React can later be holding a node that is no longer where it put it.
// Inserting before such a node adds to the end instead, and removing one
// leaves it alone, rather than failing the whole page.
export function tolerateTranslatedPage(proto: NodeMethods) {
  const insertBefore = proto.insertBefore;
  const removeChild = proto.removeChild;

  proto.insertBefore = function (node, before) {
    const ref = before as ChildNode | null;
    if (ref && ref.parentNode !== this) {
      return insertBefore.call(this, node, null as never);
    }
    return insertBefore.call(this, node, before);
  };

  proto.removeChild = function (child) {
    if ((child as ChildNode).parentNode !== this) return child;
    return removeChild.call(this, child);
  };
}
