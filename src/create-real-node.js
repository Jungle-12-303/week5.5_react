import { VNODE_TYPES } from "./constants.js";
import { setProp } from "./dom-props.js";

// 기능: COMPONENT VNode를 실제로 비교하거나 만들 수 있는 VNode까지 풀어낸다
// 입력: vnode (Object | null) — ELEMENT, TEXT, COMPONENT 중 하나인 VNode
// 출력: 최종적으로 해석된 VNode 또는 null (Object | null)
function resolveVNode(vnode) {
  if (vnode?.nodeType !== VNODE_TYPES.COMPONENT) {
    return vnode;
  }

  const renderedVNode = vnode.type({
    ...(vnode.props || {}),
    children: vnode.children,
  });

  return resolveVNode(renderedVNode);
}

// 기능: VNode 트리를 실제 DOM 노드 트리로 바꾼다
// 입력: inputVNode (Object) — 실제 DOM으로 만들 대상 VNode
// 출력: 생성된 실제 DOM 노드 (Node)
export function createRealNode(inputVNode) {
  const vnode = resolveVNode(inputVNode);

  if (!vnode) {
    return null;
  }

  if (vnode.nodeType === VNODE_TYPES.TEXT) {
    return document.createTextNode(vnode.props.nodeValue);
  }

  const domNode = document.createElement(vnode.type);

  Object.entries(vnode.props || {}).forEach(([key, value]) => {
    setProp(domNode, key, value);
  });

  vnode.children.forEach((child) => {
    const childNode = createRealNode(child);

    if (childNode) {
      domNode.appendChild(childNode);
    }
  });

  return domNode;
}

// 기능: diff 단계에서 COMPONENT VNode를 비교 가능한 최종 VNode로 해석한다
// 입력: vnode (Object | null) — 해석할 VNode
// 출력: 최종적으로 해석된 VNode 또는 null (Object | null)
export function resolveComponentVNode(vnode) {
  return resolveVNode(vnode);
}
