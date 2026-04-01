# Null Child Error Compare

## 문서 목적

이 문서는 전광판 예제에서 발생한 아래 에러를 기준으로, 수정 전/수정 후 상태를 짧게 비교한 기록이다.

```text
create-real-node.js:26 Uncaught TypeError: Cannot read properties of null (reading 'nodeType')
```

## 이 이슈가 실제로 일어날 수 있나

그렇다.

특히 지금처럼 학습용 mini-react 엔진에서는 아래 조건이 겹치면 충분히 발생할 수 있다.

- 자식 컴포넌트가 조건에 따라 `null`을 반환함
- 엔진이 `null` 자식을 실제 DOM 생성 단계에서 안전하게 건너뛰지 못함
- `useEffect` 타이머처럼 주기적으로 `setState`가 호출되어 같은 렌더가 반복됨

즉, 드문 예외라기보다 “조건부 렌더링을 도입하면 언제든 나올 수 있는 경계 케이스”에 가깝다.

## 수정 전

### 증상

- 첫 mount 직후 화면이 비거나 렌더가 중단됨
- 이후 1초 타이머가 계속 돌면서 같은 에러가 반복 출력됨
- 브라우저 콘솔에 `create-real-node.js:26` 스택이 누적됨

### 원인

상태 필터 오버레이 컴포넌트는 닫힌 상태에서 `null`을 반환했다.

- [main.js](/Users/hmm/Desktop/jungle/project/react_mini/simple_ver/mini_react/examples/departure-board/main.js#L501)

```js
if (!isStatusFilterOpen) {
  return null;
}
```

그런데 엔진의 `createRealNode()`는 모든 자식이 VNode라고 가정하고 `nodeType`을 바로 읽었다.

그래서 `null.nodeType` 접근이 발생했다.

### 왜 반복되었나

현재 시각을 1초마다 갱신하는 타이머가 계속 `setState`를 호출했기 때문이다.

- [main.js](/Users/hmm/Desktop/jungle/project/react_mini/simple_ver/mini_react/examples/departure-board/main.js#L1042)

```js
const intervalId = setInterval(() => {
  setCurrentTime(Date.now());
}, SECOND);
```

즉, 한 번 깨진 뒤에도 매초 update가 다시 돌면서 같은 에러가 반복됐다.

## 수정 후

### 변경 내용

`createRealNode()`에 `null` 가드를 추가했다.

- [create-real-node.js](/Users/hmm/Desktop/jungle/project/react_mini/simple_ver/mini_react/src/create-real-node.js#L23)

```js
const vnode = resolveVNode(inputVNode);

if (!vnode) {
  return null;
}
```

그리고 자식 노드를 붙일 때도 `null`이면 append하지 않도록 처리했다.

```js
const childNode = createRealNode(child);

if (childNode) {
  domNode.appendChild(childNode);
}
```

### 기대 결과

- 오버레이가 닫혀 있어도 렌더가 중단되지 않음
- 조건부 `null` 반환 컴포넌트를 자식으로 둘 수 있음
- 타이머가 돌아도 같은 에러가 반복되지 않음

## 검증

- 회귀 테스트 추가: [render.test.js](/Users/hmm/Desktop/jungle/project/react_mini/simple_ver/mini_react/test/render.test.js)
- 추가한 테스트 목적:
  - `child component -> return null`
  - 부모 렌더는 정상 유지
- 현재 테스트 상태: `44/44` 통과

## 로그를 볼 때 주의할 점

브라우저 콘솔 로그가 항상 “현재 코드”를 의미하는 것은 아니다.

특히 ESM 모듈과 브라우저 캐시가 겹치면:

- 수정 후에도 이전 줄 번호 기준 에러가 다시 보일 수 있음
- 서버는 최신 파일을 내려주고 있는데 브라우저가 이전 모듈 그래프를 재사용할 수 있음

따라서 이 에러를 다시 보더라도,

1. 실제 파일의 현재 줄 번호를 확인하고
2. 서버가 최신 파일을 내리는지 확인하고
3. 브라우저 캐시/재오픈 여부를 같이 봐야 한다

## 한 줄 정리

이번 이슈는 “오버레이가 `null`을 반환하는 것은 정상인데, 엔진이 그 `null`을 자식 VNode로 안전하게 처리하지 못해서 발생한 오류”였다.
