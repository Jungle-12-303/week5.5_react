# 아키텍처 리뷰

- 날짜: 2026-04-02
- 리뷰 관점: `architecture-review`
- 대상 범위: `codex/departure-board` 브랜치의 현재 `mini-react` 프로젝트

## 전체 판단

이 프로젝트는 여전히 `virtual-dom -> diff -> commit` 흐름을 중심으로 한 학습용 코어를 잘 유지하고 있습니다. 다만 최근 추가된 함수형 컴포넌트와 훅 계층은 기존 렌더링 모델을 자연스럽게 확장했다기보다, 별도의 실행 모델이 옆에 붙은 구조에 가깝습니다. 단기 데모 용도로는 충분하지만, 앞으로 재사용 가능한 상태 기반 컴포넌트를 늘리려면 구조를 다시 정리해야 할 가능성이 큽니다.

## 주요 아키텍처 이슈

### 1. 컴포넌트 실행 모델이 두 가지로 나뉘어 있습니다

현재 구조에는 컴포넌트를 실행하는 방식이 두 갈래로 존재합니다.

- `h()`는 함수 타입을 `COMPONENT` VNode로 만듭니다.
- `diff()`와 `createRealNode()`는 그 `COMPONENT` VNode를 즉시 순수 함수처럼 해석합니다.
- 반면 훅은 `FunctionComponent` 인스턴스와 전역 `currentComponent` 렌더 문맥이 있어야만 동작합니다.

이 때문에 상태를 가지는 훅 기반 컴포넌트는 `hooks-demo`에서 쓰는 `new FunctionComponent(...).mount()` 경로에서만 자연스럽게 동작하고, 일반적인 `h(MyComponent)` 트리 안에서는 같은 방식으로 확장되지 않습니다.

관련 파일:

- [h.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/h.js)
- [function-component.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/function-component.js)
- [hooks.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/hooks.js)
- [create-real-node.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/create-real-node.js)
- [diff.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/diff.js)

구조적 영향:

- 시스템 안에서 “컴포넌트”의 경계가 명확하지 않습니다.
- 중첩된 상태 기반 함수형 컴포넌트를 같은 모델로 자연스럽게 지원하기 어렵습니다.
- 앞으로 기능을 넓힐 때 점진적 확장보다 재설계 비용이 더 커질 가능성이 높습니다.

### 2. reconciliation 계층이 renderer 쪽 컴포넌트 해석 로직에 의존하고 있습니다

`diff.js`는 `create-real-node.js`로부터 `resolveComponentVNode()`를 가져와 사용하고 있습니다.

이 구조는 계층 경계를 흐리게 만듭니다.

- 컴포넌트 해석 로직이 DOM 생성 계층에 들어 있습니다.
- reconciliation 계층이 DOM 생성용 모듈에 의존하고 있습니다.
- 같은 개념적 책임이 여러 파일에 나뉘어 있습니다.

구조적 영향:

- tree normalization, reconciliation, DOM materialization이 깔끔하게 분리되어 있지 않습니다.
- 앞으로 컴포넌트 해석 규칙이 바뀌면 여러 계층을 동시에 수정해야 할 가능성이 큽니다.

관련 파일:

- [diff.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/diff.js)
- [create-real-node.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/create-real-node.js)

### 3. 공개 API와 문서 설명이 현재 구조를 따라가지 못하고 있습니다

지금 `index.js`는 hooks, debug API, `FunctionComponent`까지 외부로 export하고 있습니다. 하지만 README는 여전히 프로젝트를 기존 VDOM/diff/commit 중심의 학습 코어로 설명하고 있고, hooks는 범위 밖이라고 적혀 있습니다.

관련 파일:

- [index.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/index.js)
- [README.md](/D:/03Dev/05Jungle/mini_react/mini_react/README.md)

구조적 영향:

- 팀원이 무엇이 안정된 코어인지, 무엇이 실험적 레이어인지 구분하기 어렵습니다.
- 리뷰 기준과 확장 방향이 사람마다 달라질 수 있습니다.
- 코드에는 실제 경계가 있는데, 문서에는 그 경계가 반영되지 않습니다.

## 가정과 불확실한 점

- 이 리뷰는 현재 프로젝트가 프로덕션 프레임워크가 아니라 학습용 mini-react라는 전제를 두고 작성했습니다.
- 팀이 의도적으로 hooks를 루트 래퍼 계층에서만 동작시키려는 설계를 선택했다면, 첫 번째 이슈는 단기적으로 허용 가능한 절충일 수 있습니다.
- README에는 인코딩이 깨진 부분이 보여서, 일부 문서 의도는 정확하게 확인하기 어려웠습니다.

## 바로 할 일

1. 팀이 하나의 통합된 컴포넌트 실행 모델을 원하는지, 아니면 루트 전용 hooks 모델을 명시적으로 유지할지 먼저 결정해야 합니다.
2. 컴포넌트 해석 책임을 `diff`와 DOM 생성 양쪽이 공통으로 의존할 수 있는 중립 계층으로 분리하는 것이 좋습니다.
3. README를 현재 실제 구조에 맞게 수정해서 hooks, debug API, function component 지원 범위를 명확히 드러내야 합니다.

## 장기 개선 방향

1. 구조를 `component evaluation`, `tree diffing`, `DOM commit` 같은 명시적 단계로 분리하는 것이 좋습니다.
2. 중첩된 상태 기반 컴포넌트까지 확장할 계획이 있다면, 컴포넌트 인스턴스와 hook state의 소유 모델을 더 분명하게 설계해야 합니다.
3. 코드 export와 프로젝트 문서 모두에서 stable core와 experimental layer를 구분해두면 이후 확장 비용을 줄일 수 있습니다.

## 후속 이슈 제안

- VNode 컴포넌트와 hook 기반 컴포넌트의 실행 모델 통합
- 컴포넌트 해석 로직을 renderer 독립 모듈로 분리
- 현재 export 구조에 맞춰 README 범위와 아키텍처 설명 정리
