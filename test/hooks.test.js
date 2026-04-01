import test from "node:test";
import assert from "node:assert/strict";

import {
  FunctionComponent,
  h,
  useEffect,
  useMemo,
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

// 기능: 컴포넌트를 마운트하고 테스트에서 재사용할 객체를 묶어 반환한다
// 입력: t (TestContext) — 현재 테스트의 정리 훅을 등록할 컨텍스트
// 입력: componentFn (Function) — 마운트할 루트 컴포넌트 함수
// 출력: instance와 container를 담은 객체 (Object)
function mountComponent(t, componentFn) {
  const { container } = setupDom(t);
  const instance = new FunctionComponent(componentFn, {}, container);

  instance.mount();

  return { instance, container };
}

// 기능: 비동기 effect 큐가 비워질 때까지 한 틱 기다린다
// 입력: 없음
// 출력: Promise<void>
function flushEffects() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

// 기능: 현재 루트 컨테이너에 렌더된 첫 번째 텍스트를 읽는다
// 입력: container (Object) — 테스트용 DOM 컨테이너
// 출력: 루트 텍스트 값 (string)
function getRenderedText(container) {
  return container.childNodes[0].childNodes[0].nodeValue;
}

test("useState returns [initialValue, setter] on first call", (t) => {
  let stateSnapshot = null;

  // 기능: 첫 렌더에서 useState 반환값을 외부에 노출한다
  // 입력: 없음
  // 출력: 현재 상태를 그린 루트 VNode (Object)
  function App() {
    stateSnapshot = useState(0);
    return h("div", null, String(stateSnapshot[0]));
  }

  mountComponent(t, App);

  assert.equal(stateSnapshot[0], 0);
  assert.equal(typeof stateSnapshot[1], "function");
});

test("setter updates the stored value and triggers a re-render", (t) => {
  let stateSnapshot = null;

  // 기능: 상태값을 화면에 그대로 출력한다
  // 입력: 없음
  // 출력: 현재 상태를 그린 루트 VNode (Object)
  function App() {
    stateSnapshot = useState(0);
    return h("div", null, String(stateSnapshot[0]));
  }

  const { container, instance } = mountComponent(t, App);

  stateSnapshot[1](1);

  assert.equal(instance.hooks[0].value, 1);
  assert.equal(getRenderedText(container), "1");
});

test("functional updater runs exactly once per setState call", (t) => {
  let stateSnapshot = null;
  let updaterCallCount = 0;

  // 기능: 함수형 updater가 몇 번 호출되는지 검증한다
  // 입력: 없음
  // 출력: 현재 상태를 그린 루트 VNode (Object)
  function App() {
    stateSnapshot = useState(0);
    return h("div", null, String(stateSnapshot[0]));
  }

  const { container, instance } = mountComponent(t, App);

  stateSnapshot[1]((currentValue) => {
    updaterCallCount += 1;
    return currentValue + 1;
  });

  assert.equal(updaterCallCount, 1);
  assert.equal(instance.hooks[0].value, 1);
  assert.equal(getRenderedText(container), "1");
});

test("setter reference is stable across renders", (t) => {
  let firstSetter = null;
  let secondSetter = null;

  // 기능: 각 렌더에서 받은 setter 참조를 기록한다
  // 입력: 없음
  // 출력: 현재 상태를 그린 루트 VNode (Object)
  function App() {
    const [count, setCount] = useState(0);

    if (!firstSetter) {
      firstSetter = setCount;
    } else {
      secondSetter = setCount;
    }

    return h("div", null, String(count));
  }

  mountComponent(t, App);
  firstSetter(1);

  assert.equal(secondSetter, firstSetter);
});

test("useEffect callback runs after mount, not during render", async (t) => {
  const order = [];

  // 기능: 렌더 시점과 effect 시점을 순서대로 기록한다
  // 입력: 없음
  // 출력: 고정된 루트 VNode (Object)
  function App() {
    useEffect(() => {
      order.push("effect");
    }, []);

    order.push("render");
    return h("div", null, "ready");
  }

  mountComponent(t, App);

  assert.deepEqual(order, ["render"]);

  await flushEffects();

  assert.deepEqual(order, ["render", "effect"]);
});

test("useEffect with [] deps runs only once across updates", async (t) => {
  let runCount = 0;

  // 기능: 빈 deps effect가 몇 번 실행됐는지 센다
  // 입력: 없음
  // 출력: 고정된 루트 VNode (Object)
  function App() {
    useEffect(() => {
      runCount += 1;
    }, []);

    return h("div", null, "once");
  }

  const { instance } = mountComponent(t, App);

  await flushEffects();
  instance.update();
  await flushEffects();
  instance.update();
  await flushEffects();

  assert.equal(runCount, 1);
});

test("useEffect re-runs when a dependency changes", async (t) => {
  let currentValue = "A";
  let runCount = 0;

  // 기능: deps 값이 바뀔 때마다 effect 실행 횟수를 누적한다
  // 입력: 없음
  // 출력: 현재 deps 값을 그린 루트 VNode (Object)
  function App() {
    const valueForRender = currentValue;

    useEffect(() => {
      runCount += 1;
    }, [valueForRender]);

    return h("div", null, valueForRender);
  }

  const { instance } = mountComponent(t, App);

  await flushEffects();

  currentValue = "B";
  instance.update();
  await flushEffects();

  assert.equal(runCount, 2);
});

test("useEffect calls cleanup before re-running", async (t) => {
  let currentValue = 1;
  const events = [];

  // 기능: effect 실행과 cleanup 호출 순서를 기록한다
  // 입력: 없음
  // 출력: 현재 deps 값을 그린 루트 VNode (Object)
  function App() {
    const valueForRender = currentValue;

    useEffect(() => {
      events.push(`run:${valueForRender}`);

      return () => {
        events.push(`cleanup:${valueForRender}`);
      };
    }, [valueForRender]);

    return h("div", null, String(valueForRender));
  }

  const { instance } = mountComponent(t, App);

  await flushEffects();

  currentValue = 2;
  instance.update();
  await flushEffects();

  assert.deepEqual(events, ["run:1", "cleanup:1", "run:2"]);
});

test("useEffect cleanup runs when the component unmounts", async (t) => {
  const events = [];

  // 기능: unmount 시 effect cleanup이 호출되는지 기록한다
  // 입력: 없음
  // 출력: 고정된 루트 VNode (Object)
  function App() {
    useEffect(() => {
      events.push("run");

      return () => {
        events.push("cleanup");
      };
    }, []);

    return h("div", null, "mounted");
  }

  const { instance, container } = mountComponent(t, App);

  await flushEffects();
  const unmountResult = instance.unmount();

  assert.deepEqual(events, ["run", "cleanup"]);
  assert.equal(container.childNodes.length, 0);
  assert.equal(unmountResult.rootDomNode, null);
});

test("useEffect without deps runs on every render", async (t) => {
  let runCount = 0;

  // 기능: deps 없는 effect가 렌더마다 실행되는지 센다
  // 입력: 없음
  // 출력: 고정된 루트 VNode (Object)
  function App() {
    useEffect(() => {
      runCount += 1;
    });

    return h("div", null, "always");
  }

  const { instance } = mountComponent(t, App);

  await flushEffects();
  instance.update();
  await flushEffects();
  instance.update();
  await flushEffects();

  assert.equal(runCount, 3);
});

test("useMemo returns the cached value when deps are unchanged", (t) => {
  let computeCount = 0;
  let firstValue = 1;
  let secondValue = 2;
  let memoValue = null;

  // 기능: 같은 deps에서는 useMemo 계산 결과를 재사용한다
  // 입력: 없음
  // 출력: 현재 메모 값을 그린 루트 VNode (Object)
  function App() {
    memoValue = useMemo(() => {
      computeCount += 1;
      return firstValue + secondValue;
    }, [firstValue, secondValue]);

    return h("div", null, String(memoValue));
  }

  const { instance } = mountComponent(t, App);

  assert.equal(memoValue, 3);

  instance.update();

  assert.equal(computeCount, 1);
  assert.equal(memoValue, 3);
});

test("useMemo recomputes when a dependency changes", (t) => {
  let computeCount = 0;
  let firstValue = 1;
  let secondValue = 2;
  let memoValue = null;

  // 기능: deps가 바뀌면 useMemo 계산을 다시 실행한다
  // 입력: 없음
  // 출력: 현재 메모 값을 그린 루트 VNode (Object)
  function App() {
    memoValue = useMemo(() => {
      computeCount += 1;
      return firstValue + secondValue;
    }, [firstValue, secondValue]);

    return h("div", null, String(memoValue));
  }

  const { instance } = mountComponent(t, App);

  firstValue = 2;
  instance.update();

  assert.equal(computeCount, 2);
  assert.equal(memoValue, 4);
});

test("multiple useState slots keep independent values", (t) => {
  let setFirst = null;
  let setSecond = null;

  // 기능: 두 개의 상태 슬롯을 각각 따로 렌더링한다
  // 입력: 없음
  // 출력: 두 상태를 함께 그린 루트 VNode (Object)
  function App() {
    const [first, nextFirst] = useState(0);
    const [second, nextSecond] = useState("x");

    setFirst = nextFirst;
    setSecond = nextSecond;

    return h("div", null, `${first}:${second}`);
  }

  const { container, instance } = mountComponent(t, App);

  setFirst(1);
  assert.equal(getRenderedText(container), "1:x");
  assert.equal(instance.hooks[1].value, "x");

  setSecond("y");
  assert.equal(getRenderedText(container), "1:y");
  assert.equal(instance.hooks[0].value, 1);
});

test("mixed hook types work in sequence without slot collisions", async (t) => {
  let computeCount = 0;
  let effectCount = 0;
  let setValue = null;

  // 기능: state, memo, effect를 순서대로 함께 사용한다
  // 입력: 없음
  // 출력: 상태와 메모 값을 함께 그린 루트 VNode (Object)
  function App() {
    const [value, nextValue] = useState(1);
    const doubled = useMemo(() => {
      computeCount += 1;
      return value * 2;
    }, [value]);

    useEffect(() => {
      effectCount += 1;
    }, [value]);

    setValue = nextValue;

    return h("div", null, `${value}:${doubled}`);
  }

  const { container, instance } = mountComponent(t, App);

  await flushEffects();

  assert.equal(getRenderedText(container), "1:2");
  assert.equal(computeCount, 1);
  assert.equal(effectCount, 1);
  assert.equal(instance.hooks.length, 3);

  setValue(2);
  await flushEffects();

  assert.equal(getRenderedText(container), "2:4");
  assert.equal(computeCount, 2);
  assert.equal(effectCount, 2);
  assert.equal(instance.hooks.length, 3);
});
