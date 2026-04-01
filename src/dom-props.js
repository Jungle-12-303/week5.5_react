const LISTENER_STORE_KEY = Symbol("mini-react-listeners"); // 이벤트 리스너 참조를 저장하는 숨은 칸

// 기능: prop 이름이 이벤트 리스너용인지 확인한다
// 입력: key (string) — 검사할 prop 이름
// 출력: 이벤트 prop 여부 (boolean)
function isEventProp(key) {
  return key.startsWith("on") && key.length > 2;
}

// 기능: onClick 같은 prop 이름에서 실제 이벤트 이름을 꺼낸다
// 입력: key (string) — 이벤트 prop 이름
// 출력: 소문자 이벤트 이름 (string)
function getEventName(key) {
  return key.slice(2).toLowerCase();
}

// 기능: 주어진 prop 값을 실제 DOM 노드에 반영한다
// 입력: domNode (HTMLElement) — 속성을 적용할 실제 DOM 노드
// 입력: key (string) — 반영할 prop 이름
// 입력: value (any) — DOM에 기록할 값
// 출력: 없음
export function setProp(domNode, key, value) {
  if (value == null) {
    removeProp(domNode, key);
    return;
  }

  if (isEventProp(key)) {
    const eventName = getEventName(key);

    removeProp(domNode, key);

    if (typeof value !== "function") {
      return;
    }

    if (!domNode[LISTENER_STORE_KEY]) {
      domNode[LISTENER_STORE_KEY] = {};
    }

    domNode[LISTENER_STORE_KEY][eventName] = value;

    if (typeof domNode.addEventListener === "function") {
      domNode.addEventListener(eventName, value);
      return;
    }

    domNode[`on${eventName}`] = value;
    return;
  }

  if (key === "className") {
    domNode.className = value;
    return;
  }

  if (key === "nodeValue") {
    domNode.nodeValue = value;
    return;
  }

  if (key === "value") {
    domNode.value = value;
    return;
  }

  domNode.setAttribute(key, value);
}

// 기능: 주어진 prop을 실제 DOM 노드에서 제거한다
// 입력: domNode (HTMLElement) — 속성을 제거할 실제 DOM 노드
// 입력: key (string) — 제거할 prop 이름
// 출력: 없음
export function removeProp(domNode, key) {
  if (isEventProp(key)) {
    const eventName = getEventName(key);
    const listener = domNode[LISTENER_STORE_KEY]?.[eventName];

    if (!listener) {
      domNode[`on${eventName}`] = null;
      return;
    }

    if (typeof domNode.removeEventListener === "function") {
      domNode.removeEventListener(eventName, listener);
    } else {
      domNode[`on${eventName}`] = null;
    }

    delete domNode[LISTENER_STORE_KEY][eventName];
    return;
  }

  if (key === "className") {
    domNode.className = "";
    return;
  }

  if (key === "nodeValue") {
    domNode.nodeValue = "";
    return;
  }

  if (key === "value") {
    domNode.value = "";
    return;
  }

  domNode.removeAttribute(key);
}

// 기능: 이전 props와 새 props를 비교해서 실제 DOM 속성을 맞춘다
// 입력: domNode (HTMLElement) — 속성을 반영할 실제 DOM 노드
// 입력: oldProps (Object) — 이전 렌더의 props 모음
// 입력: newProps (Object) — 이번 렌더의 props 모음
// 출력: 없음
export function updateProps(domNode, oldProps = {}, newProps = {}) {
  const keys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

  keys.forEach((key) => {
    if (oldProps[key] === newProps[key]) {
      return;
    }

    if (!(key in newProps)) {
      removeProp(domNode, key);
      return;
    }

    setProp(domNode, key, newProps[key]);
  });
}
