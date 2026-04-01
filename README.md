# mini-react

React의 핵심 개념인 `Virtual DOM`, `diff`, `commit` 흐름을 직접 구현하고 이해하기 위한 학습용 mini-react  프로젝트입니다.


이 프로젝트는 React 전체를 복제하는 것이 아니라, 아래 질문에 답할 수 있도록 만드는 데 집중합니다.

- UI를 왜 JavaScript 객체 트리로 표현하는가?
- 이전 화면과 현재 화면의 차이는 어떻게 찾는가?
- 변경된 부분만 실제 DOM에 어떻게 반영하는가?

## Project Summary

- `src/`
  - mini-react 코어
  - VNode 생성, DOM -> VNode 변환, diff, commit, render 관련 코드
- `examples/virtual-dom-lab`
  - 발표/시연용 데모 페이지
  - 실제 DOM, 테스트 DOM, Virtual DOM 트리, diff 결과를 화면에서 확인 가능
- `test/`
  - 코어 로직 최소 검증

## What We Implemented

현재 프로젝트는 아래 범위를 구현합니다.

- VNode shape
  - `nodeType`
  - `type`
  - `props`
  - `children`
- VNode type 3개
  - `ELEMENT`
  - `TEXT`
  - `COMPONENT`
- Patch type 5개
  - `CREATE`
  - `REMOVE`
  - `REPLACE`
  - `UPDATE_PROP`
  - `UPDATE_TEXT`
- 브라우저 DOM -> Virtual DOM 변환
- 이전/새 Virtual DOM 비교(diff)
- patch를 실제 DOM에 반영(commit)
- 학습용 데모 페이지

## Core Architecture

프로젝트의 핵심 흐름은 아래와 같습니다.

1. 실제 DOM 또는 입력 UI 구조를 읽어 `Virtual DOM`을 만듭니다.
2. 이전 스냅샷과 새 스냅샷을 비교해서 `patch` 목록을 만듭니다.
3. patch를 실제 DOM에 반영합니다.
4. 반영 후 새 스냅샷을 다음 비교 기준으로 저장합니다.

코드 기준으로 보면:

- [h.js](/home/leeminjeong/workspace/python_project/mini-react/src/h.js)
  - VNode 생성
- [dom-to-vnode.js](/home/leeminjeong/workspace/python_project/mini-react/src/dom-to-vnode.js)
  - 실제 DOM을 VNode로 변환
- [diff.js](/home/leeminjeong/workspace/python_project/mini-react/src/diff.js)
  - 이전/새 VNode 비교
- [commit.js](/home/leeminjeong/workspace/python_project/mini-react/src/commit.js)
  - patch를 실제 DOM에 반영
- [render.js](/home/leeminjeong/workspace/python_project/mini-react/src/render.js)
  - render 흐름 연결

## Demo

발표용 핵심 데모는 [examples/virtual-dom-lab/index.html](/home/leeminjeong/workspace/python_project/mini-react/examples/virtual-dom-lab/index.html)입니다.

이 데모에서는 아래를 확인할 수 있습니다.

- Actual DOM
- 테스트 영역 DOM
- HTML 코드 편집 영역
- 이전 Virtual DOM
- 현재 테스트 Virtual DOM
- Diff 결과
- DOM 반영 API 로그
- State History

즉 사용자는:

- 테스트 영역을 직접 수정하거나
- HTML 코드 편집 영역에서 코드를 바꾸고
- 그 결과가 Virtual DOM, diff, patch, 실제 DOM 반영에 어떻게 이어지는지 볼 수 있습니다.

## How To Run

이 프로젝트는 별도 빌드 도구 없이도 정적 서버로 확인할 수 있습니다.

예시:

```bash
cd /home/leeminjeong/workspace/python_project/mini-react
python3 -m http.server 8000
```

브라우저에서 아래 주소를 열면 됩니다.

- `http://localhost:8000/examples/virtual-dom-lab/`

간단 예제:

- `http://localhost:8000/examples/basic-counter/`

## Test

테스트 실행:

```bash
cd /home/leeminjeong/workspace/python_project/mini-react
npm test
```

또는:

```bash
node --test test/*.test.js
```

현재 테스트는 아래를 최소 검증합니다.

- VNode 생성
- text node 처리
- diff의 기본 patch 생성
- render의 기본 흐름

## Directory Structure

```text
mini-react/
  src/
    commit.js
    constants.js
    create-real-node.js
    diff.js
    dom-props.js
    dom-to-vnode.js
    h.js
    index.js
    path.js
    render.js
  examples/
    basic-counter/
    virtual-dom-lab/
  test/
    diff.test.js
    h.test.js
    render.test.js
  README.md
  DECISIONS.md
```

## Presentation Points

발표에서는 아래 순서로 설명하면 좋습니다.

1. 실제 DOM을 직접 계속 수정하면 왜 부담이 될 수 있는지
2. Virtual DOM이 왜 필요한지
3. 우리 프로젝트의 VNode 구조
4. diff가 어떤 patch를 만드는지
5. commit이 patch를 실제 DOM으로 어떻게 바꾸는지
6. `virtual-dom-lab` 데모에서 실제로 상태 변화가 어떻게 보이는지

## Team Rules

팀 합의사항과 역할 분담 기준은 [DECISIONS.md](/home/leeminjeong/workspace/python_project/mini-react/DECISIONS.md)에 정리되어 있습니다.

이 문서에는 아래가 포함됩니다.

- 구현 범위
- VNode / patch 정책
- key 정책
- render / commit 용어 기준
- 팀 역할 분담

## Notes

- 이 프로젝트는 학습용 구현입니다.
- React와 완전히 동일한 내부 구조를 재현하지는 않습니다.
- JSX, hooks, production-level reconciliation은 현재 범위에 포함하지 않습니다.






감사합니다
