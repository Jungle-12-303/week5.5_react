import { render } from "./render.js";
import { emitDebugEvent } from "./debug.js";

let currentComponent = null; // 지금 렌더링 중인 루트 컴포넌트 인스턴스

// 기능: 디버그 로그에 표시할 컴포넌트 이름을 안전하게 만든다
// 입력: component (FunctionComponent) — 이름을 꺼낼 컴포넌트 인스턴스
// 출력: 사람이 읽기 쉬운 컴포넌트 이름 (string)
function getComponentName(component) {
  return component.fn?.name || "AnonymousComponent";
}

export class FunctionComponent {
  // 기능: 함수형 컴포넌트 인스턴스를 초기화한다
  // 입력: fn (Function) — 렌더링할 컴포넌트 함수
  // 입력: props (Object) — 컴포넌트에 전달할 props 객체
  // 입력: container (HTMLElement) — 렌더링 결과를 반영할 DOM 컨테이너
  // 출력: 없음
  constructor(fn, props, container) {
    this.fn = fn; // 렌더 때 호출할 컴포넌트 함수
    this.props = props || {}; // 컴포넌트에 넘길 현재 props
    this.container = container; // diff와 commit이 작업할 루트 컨테이너
    this.hooks = []; // 훅별 상태값과 메모 정보를 저장하는 사물함
    this.hookIndex = 0; // 현재 읽고 있는 훅 슬롯 번호
  }

  // 기능: 컴포넌트를 처음 렌더링하고 결과를 DOM에 반영한다
  // 입력: 없음
  // 출력: render()의 결과 객체 (Object)
  mount() {
    const componentName = getComponentName(this);

    emitDebugEvent({
      type: "render:start",
      componentName,
      message: `[render 시작] ${componentName} mount`,
    });

    currentComponent = this;
    this.hookIndex = 0;

    try {
      const vnode = this.fn(this.props);
      const result = render(vnode, this.container);

      emitDebugEvent({
        type: "render:finish",
        componentName,
        patchCount: result.patches.length,
        message: `[render 완료] ${componentName} mount (${result.patches.length} patches)`,
      });

      return result;
    } finally {
      currentComponent = null;
    }
  }

  // 기능: 상태 변경 뒤 컴포넌트를 다시 렌더링한다
  // 입력: 없음
  // 출력: render()의 결과 객체 (Object)
  update() {
    const componentName = getComponentName(this);

    emitDebugEvent({
      type: "update:start",
      componentName,
      message: `[update 실행] ${componentName} update`,
    });
    emitDebugEvent({
      type: "render:start",
      componentName,
      message: `[render 시작] ${componentName} update`,
    });

    currentComponent = this;
    this.hookIndex = 0;

    try {
      const vnode = this.fn(this.props);
      const result = render(vnode, this.container);

      emitDebugEvent({
        type: "render:finish",
        componentName,
        patchCount: result.patches.length,
        message: `[render 완료] ${componentName} update (${result.patches.length} patches)`,
      });

      return result;
    } finally {
      currentComponent = null;
    }
  }
}

// 기능: 현재 렌더링 중인 컴포넌트 인스턴스를 반환한다
// 입력: 없음
// 출력: 현재 FunctionComponent 인스턴스 또는 null (FunctionComponent | null)
export function getCurrentComponent() {
  return currentComponent;
}
