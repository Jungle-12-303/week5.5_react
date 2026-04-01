# mini-react

React의 핵심 동작 원리를 바닥부터 직접 구현한 학습용 프로젝트입니다.  
Virtual DOM, Diff/Patch, Hooks(useState · useEffect · useMemo), FunctionComponent를 Vanilla JS로 구현합니다.

---

## 목차

1. [프로젝트 개요](#프로젝트-개요)
2. [전체 아키텍처](#전체-아키텍처)
3. [디렉토리 구조](#디렉토리-구조)
4. [핵심 구현](#핵심-구현)
   - [Virtual DOM](#virtual-dom)
   - [Diff 알고리즘](#diff-알고리즘)
   - [Commit (Patch 적용)](#commit-patch-적용)
   - [FunctionComponent](#functioncomponent)
   - [Hooks](#hooks)
5. [예제 애플리케이션](#예제-애플리케이션)
   - [Basic Counter](#basic-counter)
   - [Hooks Demo](#hooks-demo)
   - [Departure Board](#departure-board)
   - [Virtual DOM Lab](#virtual-dom-lab)
6. [테스트](#테스트)
7. [실행 방법](#실행-방법)

---

## 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 언어 | Vanilla JavaScript (ES Modules) |
| 외부 의존성 | 없음 |
| 테스트 | Node.js 내장 `node:test` |
| 빌드 | 불필요 |

### 구현 목표 (requirements.md 기반)

```
✅ 함수형 컴포넌트 (FunctionComponent 클래스)
✅ useState  — 상태 관리 및 자동 리렌더링
✅ useEffect — 사이드 이펙트 및 클린업
✅ useMemo   — 파생값 메모이제이션
✅ Virtual DOM 생성 → Diff → Patch 파이프라인
✅ 상태 끌어올리기 패턴 (Lifting State Up)
✅ 단위 테스트 + 통합 테스트
```

---

## 전체 아키텍처

```mermaid
flowchart TD
    A["h(type, props, children)"] -->|"VNode 생성"| B[VNode Tree]
    B --> C["render(vnode, container)"]
    C -->|"최초 마운트"| D["diff(null, newVNode)"]
    C -->|"업데이트"| E["diff(oldVNode, newVNode)"]
    D --> F[Patch Array]
    E --> F
    F --> G["commitPatches(rootNode, patches)"]
    G -->|"CREATE / REMOVE<br>REPLACE / UPDATE_PROP<br>UPDATE_TEXT"| H[실제 DOM]

    subgraph hooks["Hooks Layer (FunctionComponent)"]
        I["mount() / update()"] -->|"currentComponent = this<br>hookIndex = 0"| J["fn(props) 호출"]
        J --> K["useState / useEffect / useMemo<br>→ hooks 배열 슬롯 읽기/쓰기"]
        K -->|"VNode 반환"| C
    end

    style hooks fill:#f0f4ff,stroke:#4a6cf7
```

---

## 디렉토리 구조

```
mini_react/
├── src/                        # 핵심 라이브러리
│   ├── index.js                # 공개 API 재내보내기
│   ├── constants.js            # VNODE_TYPES, PATCH_TYPES 상수
│   ├── h.js                    # VNode 팩토리 (createElement)
│   ├── render.js               # 렌더 오케스트레이터
│   ├── diff.js                 # Virtual DOM 비교 알고리즘
│   ├── commit.js               # Patch → 실제 DOM 반영
│   ├── create-real-node.js     # VNode → DOM 노드 생성
│   ├── dom-props.js            # 속성/이벤트 핸들러 관리
│   ├── path.js                 # DOM 경로 유틸리티
│   ├── function-component.js   # FunctionComponent 클래스
│   ├── hooks.js                # useState, useEffect, useMemo
│   ├── debug.js                # 디버그 이벤트 버스
│   └── dom-to-vnode.js         # 실제 DOM → VNode 변환
│
├── examples/
│   ├── basic-counter/          # render/diff/commit 기초 데모
│   ├── hooks-demo/             # 훅 3종 동작 확인 데모
│   ├── departure-board/        # 출발 안내판 (메인 예제)
│   └── virtual-dom-lab/        # Virtual DOM 학습 인터랙티브 실습
│
├── test/
│   ├── h.test.js
│   ├── diff.test.js
│   ├── render.test.js
│   ├── function-component.test.js
│   ├── hooks.test.js
│   └── hooks-demo.test.js
│
├── package.json
└── requirements.md
```

---

## 핵심 구현

### Virtual DOM

Virtual DOM은 실제 DOM을 모방하는 **순수 JS 객체 트리**입니다.  
`h()` 함수로 VNode를 생성하고, 세 가지 노드 타입을 구분합니다.

```mermaid
classDiagram
    class VNode {
        +nodeType: ELEMENT | TEXT | COMPONENT
        +type: string | Function
        +props: Object
        +children: VNode[]
    }

    class ElementVNode {
        nodeType = ELEMENT
        type = "div" | "span" | ...
    }

    class TextVNode {
        nodeType = TEXT
        type = "TEXT_ELEMENT"
        props.nodeValue = "텍스트"
    }

    class ComponentVNode {
        nodeType = COMPONENT
        type = Function
    }

    VNode <|-- ElementVNode
    VNode <|-- TextVNode
    VNode <|-- ComponentVNode
```

**VNode 생성 예시:**

```js
// <div class="board"><h1>출발 안내</h1></div>
h('div', { className: 'board' },
  h('h1', null, '출발 안내')
)

// 결과 VNode 트리
{
  nodeType: ELEMENT,
  type: 'div',
  props: { className: 'board' },
  children: [
    {
      nodeType: ELEMENT,
      type: 'h1',
      props: {},
      children: [
        { nodeType: TEXT, type: 'TEXT_ELEMENT', props: { nodeValue: '출발 안내' }, children: [] }
      ]
    }
  ]
}
```

---

### Diff 알고리즘

이전 VNode와 새 VNode를 비교해 **최소한의 변경 목록(Patch[])** 을 계산합니다.

```mermaid
flowchart TD
    A["diff(oldVNode, newVNode)"] --> B{old가 null?}
    B -->|Yes| C["PATCH: CREATE"]
    B -->|No| D{new가 null?}
    D -->|Yes| E["PATCH: REMOVE"]
    D -->|No| F{노드 타입 같음?}
    F -->|No| G["PATCH: REPLACE"]
    F -->|Yes| H{TEXT 노드?}
    H -->|Yes| I{nodeValue 변경?}
    I -->|Yes| J["PATCH: UPDATE_TEXT"]
    I -->|No| K[변경 없음]
    H -->|No| L["diffProps → UPDATE_PROP*"]
    L --> M{자식 존재?}
    M -->|key 있음| N[Key 기반 diffing]
    M -->|key 없음| O[Index 기반 diffing]
    N --> P["Patch[] 반환"]
    O --> P
```

**Patch 종류:**

| Patch 타입 | 설명 |
|---|---|
| `CREATE` | 새 노드 추가 |
| `REMOVE` | 기존 노드 제거 |
| `REPLACE` | 노드 전체 교체 (타입 변경 시) |
| `UPDATE_PROP` | 속성/이벤트 변경 |
| `UPDATE_TEXT` | 텍스트 내용 변경 |

**Key 기반 vs Index 기반 Diffing:**

```mermaid
flowchart LR
    subgraph key["Key 기반 (key prop 존재 시)"]
        K1["old: A→B→C"] --> K2["new: C→A→B"]
        K2 --> K3["key로 매칭<br>순서 변경 감지 가능"]
    end

    subgraph index["Index 기반 (key 없을 때)"]
        I1["old: A→B→C"] --> I2["new: A→X→C"]
        I2 --> I3["위치[1] 비교<br>B→X REPLACE 생성"]
    end
```

---

### Commit (Patch 적용)

Patch 배열을 순서대로 실제 DOM에 반영합니다.  
`path` 문자열(`"root.children[0].children[2]"`)로 대상 노드를 정확히 찾아 조작합니다.

```mermaid
sequenceDiagram
    participant R as render.js
    participant D as diff.js
    participant C as commit.js
    participant DOM as 실제 DOM

    R->>D: diff(oldVNode, newVNode)
    D-->>R: Patch[]
    R->>C: commitPatches(rootNode, patches)
    loop 각 Patch
        C->>C: getNodeByPath(path)
        alt CREATE
            C->>DOM: appendChild(createRealNode)
        else REMOVE
            C->>DOM: removeChild(target)
        else REPLACE
            C->>DOM: replaceChild(new, old)
        else UPDATE_PROP
            C->>DOM: updateProps(node, oldProps, newProps)
        else UPDATE_TEXT
            C->>DOM: target.nodeValue = newValue
        end
    end
```

---

### FunctionComponent

상태를 가진 **루트 컴포넌트 래퍼 클래스**입니다.  
요구사항에 따라 Hook은 최상위 컴포넌트에서만 사용하고, 자식은 순수 함수로 유지합니다.

```mermaid
classDiagram
    class FunctionComponent {
        +fn: Function
        +props: Object
        +container: HTMLElement
        +hooks: Array
        +hookIndex: number
        +mount()
        +update()
    }

    note for FunctionComponent "mount() / update() 실행 시:<br>  1. currentComponent = this<br>  2. hookIndex = 0으로 리셋<br>  3. fn(props) 호출 → VNode 획득<br>  4. render(vnode, container)<br>  5. currentComponent = null"
```

**컴포넌트 트리 설계 원칙 (Lifting State Up):**

```mermaid
graph TD
    ROOT["Root FunctionComponent<br>(useState, useEffect, useMemo 사용 가능)"]
    C1["Child Component A<br>(props만 수신, 순수 함수)"]
    C2["Child Component B<br>(props만 수신, 순수 함수)"]
    C3["Child Component C<br>(props만 수신, 순수 함수)"]

    ROOT -->|"props 전달"| C1
    ROOT -->|"props 전달"| C2
    C2 -->|"props 전달"| C3

    style ROOT fill:#4a6cf7,color:#fff
    style C1 fill:#e8f0fe,stroke:#4a6cf7
    style C2 fill:#e8f0fe,stroke:#4a6cf7
    style C3 fill:#e8f0fe,stroke:#4a6cf7
```

> 상태는 루트에서만 관리되며, 자식 컴포넌트는 `props`만 받아 렌더링합니다.

---

### Hooks

훅은 `FunctionComponent`의 `hooks` 배열에 **슬롯 단위**로 저장됩니다.  
`hookIndex`가 렌더링마다 0부터 순서대로 증가하므로 **훅 호출 순서가 일정해야** 합니다.

```mermaid
flowchart LR
    subgraph render["fn(props) 실행 중"]
        H1["useState(0)<br>hooks[0]"]
        H2["useMemo(fn, deps)<br>hooks[1]"]
        H3["useEffect(cb, deps)<br>hooks[2]"]
    end

    subgraph slots["hooks 배열"]
        S0["[0] : value, setState"]
        S1["[1] : value, deps"]
        S2["[2] : deps, cleanup"]
    end

    H1 --> S0
    H2 --> S1
    H3 --> S2
```

#### useState

```mermaid
sequenceDiagram
    participant F as fn(props)
    participant H as hooks[i]
    participant C as FunctionComponent

    F->>H: useState(initialValue)
    H-->>F: [value, setState]
    Note over F: 사용자 이벤트 발생
    F->>H: setState(newValue)
    H->>C: component.update()
    C->>F: fn(props) 재호출
    H-->>F: [newValue, setState]
```

#### useEffect

```mermaid
flowchart TD
    A["useEffect(callback, deps) 호출"] --> B{첫 호출?}
    B -->|Yes| C["슬롯 생성<br>deps=undefined"]
    B -->|No| D{deps 변경?}
    C --> E["queueMicrotask 스케줄"]
    D -->|No| F[skip]
    D -->|Yes| E
    E --> G["렌더링 완료 후 실행"]
    G --> H{이전 cleanup 있음?}
    H -->|Yes| I["cleanup() 호출"]
    H -->|No| J["callback() 실행"]
    I --> J
    J --> K["반환값을 cleanup으로 저장"]
```

#### useMemo

```mermaid
flowchart TD
    A["useMemo(fn, deps) 호출"] --> B{첫 호출?}
    B -->|Yes| C["fn() 실행 후 결과 캐싱"]
    B -->|No| D{deps 변경?}
    D -->|No| E["캐시된 값 반환"]
    D -->|Yes| F["fn() 재실행 후 새 값 캐싱"]
    C --> G[값 반환]
    F --> G
    E --> G
```

---

## 예제 애플리케이션

### Basic Counter

가장 단순한 데모. `FunctionComponent`나 훅 없이 `h()` + `render()` 직접 사용.  
버튼 클릭마다 diff 결과(패치 목록, oldVDOM, newVDOM)를 패널에 시각화합니다.

```
examples/basic-counter/index.html
```

---

### Hooks Demo

`FunctionComponent`와 훅 3종의 독립적 동작을 검증하는 데모.

```mermaid
graph TD
    DA["DashboardApp<br>(Root FunctionComponent)"]
    DA -->|"count, step"| HC["HeadlineCard<br>(순수 컴포넌트)"]
    DA -->|"tone"| TC["ThemeCard<br>(순수 컴포넌트)"]
    DA -->|"effectLog"| EL["EffectLog<br>(순수 컴포넌트)"]

    subgraph hooks2["DashboardApp 내 훅"]
        US1["useState(count)"]
        US2["useState(step)"]
        US3["useState(tone)"]
        UM["useMemo(parityLabel, nextCount, ...)<br>deps: count, step"]
        UE["useEffect(title 업데이트)<br>deps: count, step"]
    end

    style DA fill:#4a6cf7,color:#fff
    style HC fill:#e8f0fe,stroke:#4a6cf7
    style TC fill:#e8f0fe,stroke:#4a6cf7
    style EL fill:#e8f0fe,stroke:#4a6cf7
```

**핵심 포인트:** `tone`(테마) 변경 시 리렌더링은 일어나지만, `useMemo`와 `useEffect`의 deps에 `tone`이 없으므로 재계산/재실행되지 않습니다.

```
examples/hooks-demo/index.html
```

---

### Departure Board

메인 예제 애플리케이션. 공항/기차역 출발 안내판을 구현합니다.

```
examples/departure-board/index.html
```

#### 컴포넌트 구조

```mermaid
%%{init: { 
  'themeVariables': { 'fontSize': '50px' },
  'flowchart': { 'nodeSpacing': 120, 'rankSpacing': 100 }
}}%%
flowchart TD
    %% 노드용 스타일 (파란색 포인트 외곽선)
    classDef leafBox fill:#ffffff,stroke:#00a8ff,stroke-width:3px,color:#1a1a1a,border-radius:2px,font-family:'Comic Sans MS', 'Chalkboard SE', sans-serif;

    subgraph App [DepartureBoardApp]
        direction LR
        
        subgraph CP [ControlPanel]
            direction TB
            CF[ControlForm]:::leafBox
            
            subgraph RDL [RegisteredDeparturesList]
                direction TB
                subgraph RDC [RegisteredDepartureCard]
                    SB1[StatusBadge]:::leafBox
                end
            end
        end
        
        CP ~~~ BS

        subgraph BS [BoardScreen]
            direction TB
            
            subgraph BT [BoardToolbar]
                SM[SummaryMetric]:::leafBox
            end
            
            subgraph DL [DepartureList]
                direction TB
                TH[TableHeadCell]:::leafBox
                SF[StatusFilterHeadCell]:::leafBox
                SB2[StatusBadge]:::leafBox

                TH ~~~ SF
                SF ~~~ SB2
            end
        end
    end

    %% 컨테이너(서브그래프)용 스타일 (스케치 느낌의 두꺼운 검은색 테두리)
    style App fill:#fcfcfc,stroke:#1a1a1a,stroke-width:4px,color:#1a1a1a,font-weight:bold
    style CP fill:#ffffff,stroke:#1a1a1a,stroke-width:3px,color:#1a1a1a,stroke-dasharray: 5 5
    style BS fill:#ffffff,stroke:#1a1a1a,stroke-width:3px,color:#1a1a1a,stroke-dasharray: 5 5
    style RDL fill:#f9f9f9,stroke:#1a1a1a,stroke-width:2px,color:#1a1a1a
    style RDC fill:#ffffff,stroke:#1a1a1a,stroke-width:2px,color:#1a1a1a
    style BT fill:#f9f9f9,stroke:#1a1a1a,stroke-width:2px,color:#1a1a1a
    %% DL 서브그래프 스타일 수정 예시
    style DL fill:#f9f9f9,stroke:#1a1a1a,stroke-width:2px,padding:2px

```

#### 상태 및 훅 설계

```mermaid
flowchart LR
    subgraph state["useState (루트)"]
        S1["departures[]"]
        S2["currentTime (ms)"]
        S3["form 입력값"]
        S4["statusFilter"]
    end

    subgraph effect["useEffect"]
        E1["deps: []<br>setInterval 1초마다<br>setCurrentTime(Date.now())<br>cleanup: clearInterval"]
    end

    subgraph memo["useMemo"]
        M1["deps: departures, currentTime, statusFilter<br>→ rows 정렬 및 상태 계산<br>→ filteredRows<br>→ 상태별 카운트"]
    end

    S1 --> memo
    S2 --> memo
    S4 --> memo
```

#### 항공편 상태 전환

```mermaid
stateDiagram-v2
    [*] --> SCHEDULED : 항공편 등록
    SCHEDULED --> BOARDING : 출발 10분 전
    BOARDING --> DEPARTED : 출발 시각 도달
    SCHEDULED --> DELAYED : 지연 설정
    DELAYED --> BOARDING : 출발 10분 전 (지연 기준)
    DELAYED --> SCHEDULED : 지연 해제
    BOARDING --> SCHEDULED : 수동 복귀
    note right of DEPARTED : 최종 상태
```

---

### Virtual DOM Lab

Virtual DOM의 동작 원리를 **인터랙티브하게 학습**하는 시각화 도구입니다.

```mermaid
flowchart LR
    subgraph lab["Virtual DOM Lab 파이프라인"]
        A["실제 DOM 편집<br>노드 추가/삭제/수정"] -->|"domToVNode()"| B["Current VNode Tree"]
        C["이전 VNode 스냅샷"] -->|"diff(old, new)"| D["Patch 목록"]
        B --> D
        D -->|"applyPatch()"| E["DOM 업데이트"]
        E -->|"스냅샷 저장"| C
    end
```

**주요 기능:**
- DOM 노드 클릭 선택 → 자식 추가 / 태그 교체 / 삭제
- Previous VNode ↔ Current VNode 트리 시각화
- diff 결과 패치 목록 실시간 표시
- MutationObserver 로그
- Undo/Redo 상태 히스토리

```
examples/virtual-dom-lab/index.html
```

---

## 테스트

```mermaid
graph LR
    subgraph unit["단위 테스트"]
        T1["h.test.js<br>6개"]
        T2["diff.test.js<br>11개"]
        T3["render.test.js<br>7개"]
        T4["function-component.test.js<br>5개"]
        T5["hooks.test.js<br>11개"]
    end

    subgraph integration["통합 테스트"]
        T6["hooks-demo.test.js<br>1개 (다중 시나리오)"]
    end
```

| 테스트 파일 | 검증 대상 | 주요 케이스 |
|---|---|---|
| `h.test.js` | VNode 생성 | 타입 분류, null 필터링, key 보존 |
| `diff.test.js` | Diff 알고리즘 | 5가지 Patch 생성, key 기반 재정렬, 중복 key 경고 |
| `render.test.js` | render 오케스트레이터 | 순차 렌더, null 렌더, 다중 패치 커밋 순서 |
| `function-component.test.js` | FunctionComponent | mount/update, hookIndex 리셋, currentComponent 전환 |
| `hooks.test.js` | useState/useEffect/useMemo | 초기값, 업데이트, deps 비교, cleanup, 슬롯 독립성 |
| `hooks-demo.test.js` | 통합 시나리오 | 테마 전환시 memo/effect 미실행, step 변경시 재계산 |

**테스트 실행:**

```bash
npm test
# 또는
node --test
```

> 모든 테스트는 외부 의존성 없이 Node.js 내장 `node:test`와 `node:assert/strict`만 사용합니다.  
> 브라우저 없이 실행 가능하도록 `global.document`를 직접 구성한 Fake DOM 환경을 사용합니다.

---

## 실행 방법

```bash
# 의존성 설치 불필요 (외부 패키지 없음)

# 테스트 실행
npm test

# 예제 실행 — 각 폴더의 index.html을 브라우저에서 열기
open examples/departure-board/index.html
open examples/hooks-demo/index.html
open examples/basic-counter/index.html
open examples/virtual-dom-lab/index.html
```

> ES Module을 사용하므로 `file://` 프로토콜에서 CORS 오류가 발생할 수 있습니다.  
> 로컬 서버(`npx serve .` 또는 VS Code Live Server)를 통해 열면 정상 동작합니다.

---

## 전체 업데이트 흐름 요약

```mermaid
flowchart TD
    U["사용자 이벤트<br>(클릭, 입력 등)"] --> SS["setState(newValue)"]
    SS --> UP["FunctionComponent.update()"]
    UP --> RF["fn(props) 재호출<br>hookIndex = 0으로 리셋"]
    RF --> HK["hooks 슬롯 순서대로 접근<br>useState / useMemo / useEffect"]
    HK --> NV["새 VNode 트리 반환"]
    NV --> DI["diff(oldVNode, newVNode)"]
    DI --> PA["Patch[]"]
    PA --> CM["commitPatches(rootNode, patches)"]
    CM --> DOM["실제 DOM 최소 업데이트"]
    DOM --> SC["useEffect 스케줄 실행<br>(queueMicrotask)"]

    style U fill:#fef3c7,stroke:#d97706
    style DOM fill:#d1fae5,stroke:#059669
```
