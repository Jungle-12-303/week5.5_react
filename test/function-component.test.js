import test from "node:test";
import assert from "node:assert/strict";

import {
  FunctionComponent,
  getCurrentComponent,
  h,
  PATCH_TYPES,
  useState,
} from "../src/index.js";

// 기능: 테스트용 가짜 Element 노드를 만든다
// 입력: tag (string) — 생성할 노드의 태그 이름
// 출력: 테스트용 DOM Element 객체 (Object)
function createElementNode(tag) {
  return {
    tag,
    childNodes: [],
    parentNode: null,
    attributes: {},
    className: "",
    listeners: {},
    appendChild(node) {
      return this.insertBefore(node, null);
    },
    insertBefore(node, referenceNode) {
      const nextIndex =
        referenceNode == null
          ? this.childNodes.length
          : this.childNodes.indexOf(referenceNode);

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
    addEventListener(eventName, listener) {
      this.listeners[eventName] = listener;
    },
    removeEventListener(eventName, listener) {
      if (this.listeners[eventName] === listener) {
        delete this.listeners[eventName];
      }
    },
  };
}

// 기능: 테스트용 가짜 Text 노드를 만든다
// 입력: nodeValue (string) — 텍스트 노드가 보관할 문자열
// 출력: 테스트용 DOM Text 객체 (Object)
function createTextNode(nodeValue) {
  return {
    nodeValue,
    childNodes: [],
    parentNode: null,
  };
}

// 기능: 테스트마다 사용할 가짜 document와 컨테이너를 준비한다
// 입력: t (TestContext) — 현재 테스트의 정리 훅을 등록할 컨텍스트
// 출력: container를 담은 객체 (Object)
function setupDom(t) {
  const container = createElementNode("container");

  global.document = {
    createElement: createElementNode,
    createTextNode,
  };

  t.after(() => {
    delete global.document;
  });

  return { container };
}

test("mount() calls the component function and appends output to the container", (t) => {
  const { container } = setupDom(t);
  let callCount = 0;

  // 기능: mount()가 호출될 때 렌더링 결과를 반환한다
  // 입력: 없음
  // 출력: 화면에 그릴 VNode (Object)
  function App() {
    callCount += 1;
    return h("div", { id: "app" }, "hello");
  }

  const instance = new FunctionComponent(App, {}, container);
  const result = instance.mount();

  assert.equal(callCount, 1);
  assert.equal(container.childNodes.length, 1);
  assert.equal(container.childNodes[0].tag, "div");
  assert.equal(container.childNodes[0].childNodes[0].nodeValue, "hello");
  assert.equal(result.rootDomNode, container.childNodes[0]);
});

test("update() produces minimal patches without replacing the root element", (t) => {
  const { container } = setupDom(t);
  let label = "A";

  // 기능: 닫힌 변수 label 값에 따라 다른 텍스트를 반환한다
  // 입력: 없음
  // 출력: 텍스트가 포함된 루트 VNode (Object)
  function App() {
    return h("div", { className: "panel" }, label);
  }

  const instance = new FunctionComponent(App, {}, container);
  const firstResult = instance.mount();

  label = "B";
  const secondResult = instance.update();

  assert.equal(secondResult.rootDomNode, firstResult.rootDomNode);
  assert.deepEqual(secondResult.patches, [
    {
      type: PATCH_TYPES.UPDATE_TEXT,
      path: "root.children[0]",
      oldValue: "A",
      newValue: "B",
    },
  ]);
  assert.equal(container.childNodes[0].childNodes[0].nodeValue, "B");
});

test("hooks array is populated after mount", (t) => {
  const { container } = setupDom(t);

  // 기능: useState 슬롯을 하나 사용한 뒤 정적 화면을 반환한다
  // 입력: 없음
  // 출력: 텍스트가 포함된 루트 VNode (Object)
  function App() {
    useState(0);
    return h("div", null, "ready");
  }

  const instance = new FunctionComponent(App, {}, container);
  instance.mount();

  assert.equal(instance.hooks.length, 1);
  assert.equal(instance.hooks[0].value, 0);
});

test("hookIndex resets to 0 at the start of each render", (t) => {
  const { container } = setupDom(t);
  const observedIndexes = [];
  let instance = null;

  // 기능: 렌더 시작 시점의 hookIndex 값을 기록한다
  // 입력: 없음
  // 출력: 텍스트가 포함된 루트 VNode (Object)
  function App() {
    observedIndexes.push(instance.hookIndex);
    useState("slot");
    return h("div", null, "tracked");
  }

  instance = new FunctionComponent(App, {}, container);

  instance.mount();
  instance.update();

  assert.deepEqual(observedIndexes, [0, 0]);
});

test("getCurrentComponent() returns the active instance during render and null outside", (t) => {
  const { container } = setupDom(t);
  let seenDuringRender = null;

  // 기능: 렌더 도중 현재 활성 컴포넌트 인스턴스를 읽는다
  // 입력: 없음
  // 출력: 텍스트가 포함된 루트 VNode (Object)
  function App() {
    seenDuringRender = getCurrentComponent();
    return h("div", null, "active");
  }

  const instance = new FunctionComponent(App, {}, container);

  assert.equal(getCurrentComponent(), null);
  instance.mount();

  assert.equal(seenDuringRender, instance);
  assert.equal(getCurrentComponent(), null);
});
