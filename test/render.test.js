import test from "node:test";
import assert from "node:assert/strict";

import { applyPatch, h, PATCH_TYPES, render } from "../src/index.js";

function createElementNode(tag) {
  return {
    tag,
    childNodes: [],
    parentNode: null,
    attributes: {},
    className: "",
    appendChild(node) {
      return this.insertBefore(node, null);
    },
    insertBefore(node, referenceNode) {
      const nextIndex =
        referenceNode == null ? this.childNodes.length : this.childNodes.indexOf(referenceNode);

      if (nextIndex === -1) {
        throw new Error("Reference node does not exist");
      }

      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }

      this.childNodes.splice(nextIndex, 0, node);
      node.parentNode = this;
      return node;
    },
    removeChild(node) {
      const index = this.childNodes.indexOf(node);

      if (index === -1) {
        throw new Error("Target node does not exist");
      }

      this.childNodes.splice(index, 1);
      node.parentNode = null;
      return node;
    },
    replaceChild(newNode, oldNode) {
      const index = this.childNodes.indexOf(oldNode);

      if (index === -1) {
        throw new Error("Target node does not exist");
      }

      if (newNode.parentNode) {
        newNode.parentNode.removeChild(newNode);
      }

      this.childNodes[index] = newNode;
      newNode.parentNode = this;
      oldNode.parentNode = null;
      return oldNode;
    },
    setAttribute(key, value) {
      this.attributes[key] = value;
    },
    removeAttribute(key) {
      delete this.attributes[key];
    },
  };
}

function createTextNode(nodeValue) {
  return {
    nodeValue,
    childNodes: [],
    parentNode: null,
  };
}

function setupDom() {
  const container = createElementNode("container");

  global.document = {
    createElement: createElementNode,
    createTextNode,
  };

  return { container };
}

test("render returns patches array", (t) => {
  const { container } = setupDom();
  t.after(() => {
    delete global.document;
  });

  const result = render(h("div", null, "hello"), container);

  assert.ok(Array.isArray(result.patches));
  assert.equal(result.oldVNode, null);
  assert.equal(result.newVNode.type, "div");
});

test("applyPatch removes className when UPDATE_PROP sets newValue to undefined", () => {
  const rootNode = {
    className: "card",
    removeAttributeCalls: [],
    removeAttribute(name) {
      this.removeAttributeCalls.push(name);
    },
    setAttribute() {},
  };

  const result = applyPatch(
    rootNode,
    {
      type: PATCH_TYPES.UPDATE_PROP,
      path: "root",
      key: "className",
      oldValue: "card",
      newValue: undefined,
    },
    {}
  );

  assert.equal(result, rootNode);
  assert.equal(rootNode.className, "");
});

test("render updates text and props on the existing root node", (t) => {
  const { container } = setupDom();
  t.after(() => {
    delete global.document;
  });

  const firstResult = render(
    h("button", { className: "primary", id: "save" }, "저장"),
    container
  );
  const secondResult = render(
    h("button", { className: "secondary", id: "save" }, "저장 완료"),
    container
  );

  assert.equal(container.childNodes.length, 1);
  assert.equal(secondResult.rootDomNode, firstResult.rootDomNode);
  assert.equal(secondResult.rootDomNode.className, "secondary");
  assert.equal(secondResult.rootDomNode.attributes.id, "save");
  assert.equal(secondResult.rootDomNode.childNodes[0].nodeValue, "저장 완료");
});

test("render removes the root node and clears rootDomNode", (t) => {
  const { container } = setupDom();
  t.after(() => {
    delete global.document;
  });

  render(h("div", { id: "app" }, "hello"), container);
  const removeResult = render(null, container);

  assert.equal(container.childNodes.length, 0);
  assert.equal(removeResult.rootDomNode, null);

  const nextResult = render(h("span", null, "back"), container);

  assert.equal(container.childNodes.length, 1);
  assert.equal(nextResult.rootDomNode.tag, "span");
  assert.equal(nextResult.rootDomNode.childNodes[0].nodeValue, "back");
});

test("applyPatch inserts a created child at the path index", (t) => {
  const { container } = setupDom();
  t.after(() => {
    delete global.document;
  });

  const rootNode = render(
    h(
      "ul",
      null,
      h("li", null, "second")
    ),
    container
  ).rootDomNode;

  applyPatch(
    rootNode,
    {
      type: PATCH_TYPES.CREATE,
      path: "root.children[0]",
      node: h("li", null, "first"),
    },
    container
  );

  assert.equal(rootNode.childNodes.length, 2);
  assert.equal(rootNode.childNodes[0].childNodes[0].nodeValue, "first");
  assert.equal(rootNode.childNodes[1].childNodes[0].nodeValue, "second");
});

test("render applies keyed multi-patch sequences in commit order", (t) => {
  const { container } = setupDom();
  t.after(() => {
    delete global.document;
  });

  render(
    h(
      "ul",
      null,
      h("li", { key: "a" }, "alpha"),
      h("li", { key: "b" }, "beta"),
      h("li", { key: "c" }, "gamma")
    ),
    container
  );

  const result = render(
    h(
      "ul",
      null,
      h("li", { key: "b" }, "beta updated"),
      h("li", { key: "c" }, "gamma"),
      h("li", { key: "d" }, "delta")
    ),
    container
  );

  assert.deepEqual(
    result.patches.map((patch) => patch.type),
    [PATCH_TYPES.REMOVE, PATCH_TYPES.UPDATE_TEXT, PATCH_TYPES.CREATE]
  );
  assert.equal(container.childNodes[0].childNodes.length, 3);
  assert.equal(
    container.childNodes[0].childNodes[0].childNodes[0].nodeValue,
    "beta updated"
  );
  assert.equal(
    container.childNodes[0].childNodes[1].childNodes[0].nodeValue,
    "gamma"
  );
  assert.equal(
    container.childNodes[0].childNodes[2].childNodes[0].nodeValue,
    "delta"
  );
});

test("render handles replace and remove patches in the same commit pass", (t) => {
  const { container } = setupDom();
  t.after(() => {
    delete global.document;
  });

  render(
    h(
      "div",
      null,
      h("p", null, "first"),
      h("footer", null, "tail")
    ),
    container
  );

  const result = render(
    h(
      "div",
      null,
      h("section", null, "first changed")
    ),
    container
  );

  assert.deepEqual(
    result.patches.map((patch) => patch.type),
    [PATCH_TYPES.REPLACE, PATCH_TYPES.REMOVE]
  );
  assert.equal(container.childNodes[0].childNodes.length, 1);
  assert.equal(container.childNodes[0].childNodes[0].tag, "section");
  assert.equal(
    container.childNodes[0].childNodes[0].childNodes[0].nodeValue,
    "first changed"
  );
});

test("render ignores child components that return null", (t) => {
  const { container } = setupDom();
  t.after(() => {
    delete global.document;
  });

  function HiddenBadge() {
    return null;
  }

  const result = render(
    h(
      "section",
      null,
      h("h1", null, "출발 전광판"),
      h(HiddenBadge, null),
      h("p", null, "정상 렌더")
    ),
    container
  );

  assert.equal(container.childNodes.length, 1);
  assert.equal(result.rootDomNode.tag, "section");
  assert.equal(result.rootDomNode.childNodes.length, 2);
  assert.equal(result.rootDomNode.childNodes[0].tag, "h1");
  assert.equal(result.rootDomNode.childNodes[1].tag, "p");
});
