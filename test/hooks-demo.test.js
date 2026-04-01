import test from "node:test";
import assert from "node:assert/strict";

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
    textContent: "",
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

// 기능: 문서 루트에서 id로 등록된 필수 노드들을 준비한다
// 입력: 없음
// 출력: document와 핵심 노드를 담은 객체 (Object)
function setupDocument() {
  const nodesById = {
    app: createElementNode("div"),
    "effect-log": createElementNode("p"),
    "render-count": createElementNode("span"),
    "memo-count": createElementNode("span"),
    "effect-count": createElementNode("span"),
    "last-action": createElementNode("span"),
  };

  nodesById.app.attributes.id = "app";
  nodesById["effect-log"].attributes.id = "effect-log";
  nodesById["render-count"].attributes.id = "render-count";
  nodesById["memo-count"].attributes.id = "memo-count";
  nodesById["effect-count"].attributes.id = "effect-count";
  nodesById["last-action"].attributes.id = "last-action";
  nodesById["effect-log"].textContent = "effect가 아직 실행되지 않았습니다.";
  nodesById["render-count"].textContent = "0";
  nodesById["memo-count"].textContent = "0";
  nodesById["effect-count"].textContent = "0";
  nodesById["last-action"].textContent = "초기 렌더";

  const document = {
    title: "mini-react hooks demo",
    createElement: createElementNode,
    createTextNode,
    getElementById(id) {
      return nodesById[id] || null;
    },
  };

  return {
    document,
    appNode: nodesById.app,
    effectLogNode: nodesById["effect-log"],
    renderCountNode: nodesById["render-count"],
    memoCountNode: nodesById["memo-count"],
    effectCountNode: nodesById["effect-count"],
    lastActionNode: nodesById["last-action"],
  };
}

// 기능: DOM 서브트리에서 조건에 맞는 첫 번째 노드를 찾는다
// 입력: node (Object) — 탐색을 시작할 루트 노드
// 입력: predicate (Function) — 노드 일치 여부를 판별하는 함수
// 출력: 조건에 맞는 첫 노드 또는 null (Object | null)
function findNode(node, predicate) {
  if (!node) {
    return null;
  }

  if (predicate(node)) {
    return node;
  }

  for (const child of node.childNodes || []) {
    const matchedNode = findNode(child, predicate);

    if (matchedNode) {
      return matchedNode;
    }
  }

  return null;
}

// 기능: 노드와 그 자식 텍스트를 이어 붙여 읽기 쉬운 문자열로 만든다
// 입력: node (Object | null) — 텍스트를 읽을 대상 노드
// 출력: 결합된 텍스트 문자열 (string)
function getNodeText(node) {
  if (!node) {
    return "";
  }

  if ("nodeValue" in node) {
    return node.nodeValue;
  }

  if (typeof node.textContent === "string" && node.childNodes.length === 0) {
    return node.textContent;
  }

  return (node.childNodes || []).map(getNodeText).join("");
}

// 기능: 버튼 라벨로 해당 버튼 노드를 찾는다
// 입력: rootNode (Object) — 버튼을 찾을 루트 노드
// 입력: label (string) — 찾고 싶은 버튼 텍스트
// 출력: 일치하는 버튼 노드 또는 null (Object | null)
function findButtonByLabel(rootNode, label) {
  return findNode(rootNode, (node) => {
    return node.tag === "button" && getNodeText(node) === label;
  });
}

// 기능: 버튼 클릭 리스너를 호출해 사용자 상호작용을 흉내 낸다
// 입력: buttonNode (Object | null) — 클릭할 버튼 노드
// 출력: 없음
function clickButton(buttonNode) {
  if (!buttonNode?.listeners.click) {
    throw new Error("Button click listener does not exist");
  }

  buttonNode.listeners.click({
    type: "click",
    target: buttonNode,
  });
}

// 기능: 비동기 effect 큐가 비워질 때까지 한 틱 기다린다
// 입력: 없음
// 출력: Promise<void>
function flushEffects() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

test("hooks demo mounts and updates state through real button handlers", async (t) => {
  const {
    document,
    appNode,
    effectLogNode,
    renderCountNode,
    memoCountNode,
    effectCountNode,
    lastActionNode,
  } = setupDocument();

  global.document = document;

  t.after(() => {
    delete global.document;
  });

  const moduleUrl = new URL("../examples/hooks-demo/main.js?demo-test=1", import.meta.url).href;

  await import(moduleUrl);
  await flushEffects();

  const headlineNode = findNode(appNode, (node) => node.className === "headline");

  assert.equal(getNodeText(headlineNode), "현재 count는 0입니다.");
  assert.equal(effectLogNode.textContent, "마지막 effect 실행: count=0, step=1");
  assert.equal(document.title, "mini-react hooks demo (0)");
  assert.equal(renderCountNode.textContent, "1");
  assert.equal(memoCountNode.textContent, "1");
  assert.equal(effectCountNode.textContent, "1");
  assert.equal(lastActionNode.textContent, "초기 렌더");

  clickButton(findButtonByLabel(appNode, "테마 전환 (calm)"));
  await flushEffects();

  const themeToggleButton = findButtonByLabel(appNode, "테마 전환 (bold)");

  assert.ok(themeToggleButton);
  assert.equal(renderCountNode.textContent, "2");
  assert.equal(memoCountNode.textContent, "1");
  assert.equal(effectCountNode.textContent, "1");
  assert.equal(lastActionNode.textContent, "테마만 전환");

  clickButton(findButtonByLabel(appNode, "step 5"));
  await flushEffects();

  const incrementButtonAfterStepChange = findButtonByLabel(appNode, "+5 증가");
  const nextCountCard = findNode(appNode, (node) => {
    return node.tag === "article" && getNodeText(node).includes("다음 count5");
  });

  assert.ok(incrementButtonAfterStepChange);
  assert.ok(nextCountCard);
  assert.equal(effectLogNode.textContent, "마지막 effect 실행: count=0, step=5");
  assert.equal(document.title, "mini-react hooks demo (0)");
  assert.equal(renderCountNode.textContent, "3");
  assert.equal(memoCountNode.textContent, "2");
  assert.equal(effectCountNode.textContent, "2");
  assert.equal(lastActionNode.textContent, "step을 5로 변경");

  clickButton(incrementButtonAfterStepChange);
  await flushEffects();

  const updatedHeadlineNode = findNode(appNode, (node) => node.className === "headline");
  const updatedNextCountCard = findNode(appNode, (node) => {
    return node.tag === "article" && getNodeText(node).includes("다음 count10");
  });

  assert.equal(getNodeText(updatedHeadlineNode), "현재 count는 5입니다.");
  assert.equal(effectLogNode.textContent, "마지막 effect 실행: count=5, step=5");
  assert.equal(document.title, "mini-react hooks demo (5)");
  assert.ok(updatedNextCountCard);
  assert.equal(renderCountNode.textContent, "4");
  assert.equal(memoCountNode.textContent, "3");
  assert.equal(effectCountNode.textContent, "3");
  assert.equal(lastActionNode.textContent, "count를 5만큼 증가");
});
