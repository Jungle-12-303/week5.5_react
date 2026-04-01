# 시니어 엔지니어링 리뷰

- 날짜: 2026-04-02
- 리뷰 관점: `senior-engineering-review`
- 대상 범위: `codex/departure-board` 브랜치의 현재 `mini-react` 프로젝트
- 전제: hooks는 루트 전용 모델로 유지하는 것이 팀의 의도다

## 전체 판단

함수형 컴포넌트와 hooks 레이어는 전체적으로 작은 단위로 나뉘어 있고, 핵심 동작도 테스트로 많이 커버하고 있습니다. 다만 지금 상태에는 실제 동작 버그 1건, 협업 환경에서 바로 터지는 테스트 이식성 문제 1건, 그리고 유지보수성을 떨어뜨리는 중복/문서 인코딩 문제가 남아 있습니다. 구조 자체보다 구현 품질 관점에서 이번 주 안에 손봐두는 것이 좋은 상태입니다.

## 핵심 엔지니어링 이슈

### 1. `useState`의 함수형 updater가 현재 두 번 호출됩니다

`useState` 내부 setter는 `nextValue`가 함수일 때 먼저 `resolvedValue`를 계산하고, 그 뒤 실제 상태 반영 단계에서 같은 updater 함수를 다시 호출합니다.

관련 파일:

- [hooks.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/hooks.js#L110)

문제 지점:

- `resolvedValue` 계산 시 한 번 호출
- `slot.value` 갱신 시 다시 한 번 호출

영향:

- updater 함수가 부수 효과를 가지면 의도치 않게 두 번 실행됩니다.
- 계산 비용이 큰 updater일수록 불필요한 비용이 생깁니다.
- 디버그 로그에 남긴 값과 실제 반영 경로가 분리되어 있어서 추후 수정 시 실수가 생기기 쉽습니다.

권장 조치:

- `resolvedValue`를 계산한 뒤 그 값을 그대로 `slot.value`에 대입하도록 단일 경로로 정리하는 것이 좋습니다.
- 함수형 updater가 정확히 한 번만 호출되는지 검증하는 테스트를 추가하는 것이 좋습니다.

### 2. `hooks-demo` 테스트가 절대 경로에 묶여 있어서 다른 개발 환경에서 바로 깨집니다

실제 테스트 실행 결과 44개 중 43개는 통과했고, 실패한 1개는 `hooks-demo` 테스트였습니다. 실패 원인은 구현이 아니라 테스트 파일 안에 사용자 로컬 절대 경로가 하드코딩되어 있기 때문입니다.

관련 파일:

- [hooks-demo.test.js](/D:/03Dev/05Jungle/mini_react/mini_react/test/hooks-demo.test.js#L231)

현재 문제:

- `examples/hooks-demo/main.js`를 상대 경로가 아니라 특정 사용자 PC의 절대 경로로 import하고 있습니다.
- 이 때문에 다른 팀원 환경, CI, 다른 폴더 구조에서는 바로 `ERR_MODULE_NOT_FOUND`가 발생합니다.

실행 확인 결과:

- 전체 테스트: 44개
- 통과: 43개
- 실패: 1개
- 실패 원인: `test/hooks-demo.test.js`의 절대 경로 import

권장 조치:

- 테스트 대상 모듈 경로를 현재 저장소 기준의 상대 경로 또는 테스트 파일 기준 경로로 바꾸는 것이 좋습니다.
- “내 로컬에서는 된다”가 아니라 팀 환경과 CI에서 항상 같은 결과가 나오도록 맞춰야 합니다.

### 3. 유지보수성 측면에서 중복 로직과 깨진 한글 텍스트가 눈에 띕니다

두 가지가 같이 보입니다.

첫째, `getComponentName()` helper가 중복 정의되어 있습니다.

- [function-component.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/function-component.js#L9)
- [hooks.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/hooks.js#L7)

둘째, README와 여러 소스 파일의 한글 주석/문자열이 깨져 보여서 협업자가 코드를 읽을 때 의도를 빠르게 파악하기 어렵습니다.

관련 파일 예시:

- [README.md](/D:/03Dev/05Jungle/mini_react/mini_react/README.md#L1)
- [h.js](/D:/03Dev/05Jungle/mini_react/mini_react/src/h.js#L3)

영향:

- 작은 helper가 여러 곳에 중복되면 이후 로깅 정책이나 표시 규칙을 바꿀 때 파일별로 drift가 생깁니다.
- 깨진 문서와 주석은 구현 의도를 전달하지 못해서 온보딩과 리뷰 속도를 떨어뜨립니다.

권장 조치:

- `getComponentName()` 같은 공통 helper는 한 곳으로 모으는 것이 좋습니다.
- README와 주요 소스 주석의 인코딩을 정리해서, 적어도 팀이 자주 읽는 파일은 정상 한글로 보이게 맞추는 것이 좋습니다.

## 가정과 불확실한 점

- 이번 리뷰는 “hooks는 루트 전용으로 유지한다”는 팀 의도를 전제로 했습니다.
- 따라서 일반 `h(MyComponent)` 경로에서 hooks가 동작하지 않는 점 자체는 이번 문서에서 구조적 버그로 보지 않았습니다.
- 테스트는 권한 상승으로 실행했고, 그 결과 `hooks-demo` 절대 경로 문제 외에는 통과했습니다.

## 바로 할 일

1. `useState` setter에서 updater 함수가 한 번만 실행되도록 정리합니다.
2. `test/hooks-demo.test.js`의 절대 경로 import를 상대 경로 기반으로 바꿉니다.
3. 공통 helper 중복을 줄이고, 최소한 README와 핵심 파일의 깨진 한글은 정리합니다.

## 후속 개선 사항

1. hooks 관련 테스트에 “함수형 updater는 한 번만 호출된다”는 케이스를 추가합니다.
2. 테스트에서 파일 경로를 다루는 공통 helper를 두면 이후 예제 테스트 추가가 쉬워집니다.
3. 디버그 메시지/주석/문서의 언어와 인코딩 규칙을 팀 규칙으로 한 번 정해두는 것이 좋습니다.
