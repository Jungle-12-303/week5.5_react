import { getCurrentComponent } from "./function-component.js";
import { emitDebugEvent } from "./debug.js";
import { getComponentName } from "./component-name.js";

// 기능: 디버그 로그에 남길 값을 간단한 문자열로 정리한다
// 입력: value (any) — 로그에 표시할 상태값 또는 계산 결과
// 출력: 사람이 읽기 쉬운 문자열 (string)
function formatDebugValue(value) {
  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value == null
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[Array(${value.length})]`;
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  return "[Object]";
}

// 기능: 현재 훅이 사용할 컴포넌트와 슬롯 번호를 확인한다
// 입력: 없음
// 출력: component와 index를 담은 객체 (Object)
function getHookContext() {
  const component = getCurrentComponent();

  if (!component) {
    throw new Error("Hooks can only be called during a FunctionComponent render.");
  }

  return {
    component,
    index: component.hookIndex,
  };
}

// 기능: 의존성 배열을 안전하게 복사해서 저장한다
// 입력: deps (Array | undefined) — 현재 훅이 받은 의존성 배열
// 출력: 복사된 의존성 배열 또는 undefined (Array | undefined)
function cloneDependencies(deps) {
  if (!Array.isArray(deps)) {
    return undefined;
  }

  return [...deps];
}

// 기능: 이전 의존성과 현재 의존성이 달라졌는지 비교한다
// 입력: previousDeps (Array | undefined) — 직전 렌더에서 저장한 deps
// 입력: nextDeps (Array | undefined) — 이번 렌더에서 받은 deps
// 출력: 재실행 필요 여부 (boolean)
function hasDependenciesChanged(previousDeps, nextDeps) {
  if (nextDeps === undefined || previousDeps === undefined) {
    return true;
  }

  if (previousDeps.length !== nextDeps.length) {
    return true;
  }

  for (let index = 0; index < nextDeps.length; index += 1) {
    if (previousDeps[index] !== nextDeps[index]) {
      return true;
    }
  }

  return false;
}

// 기능: 렌더가 끝난 뒤 실행할 작업을 마이크로태스크로 예약한다
// 입력: task (Function) — 나중에 실행할 콜백
// 출력: 없음
function scheduleAfterRender(task) {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(task);
    return;
  }

  setTimeout(task, 0);
}

// 기능: 상태값과 안정적인 setter 함수를 반환한다
// 입력: initialValue (any) — 슬롯이 비어 있을 때 저장할 초기 상태값
// 출력: [currentValue (any), setState (Function)]
export function useState(initialValue) {
  const { component, index } = getHookContext();
  const componentName = getComponentName(component);
  let slot = component.hooks[index];

  if (slot === undefined) {
    slot = {
      value: initialValue,
      setState(nextValue) {
        if (component.isUnmounted) {
          return;
        }

        const previousValue = slot.value;
        const resolvedValue =
          typeof nextValue === "function" ? nextValue(slot.value) : nextValue;

        emitDebugEvent({
          type: "useState:set",
          componentName,
          hookIndex: index,
          previousValue: formatDebugValue(previousValue),
          nextValue: formatDebugValue(resolvedValue),
          message: `[setState 호출] ${componentName} hook[${index}] ${formatDebugValue(previousValue)} -> ${formatDebugValue(resolvedValue)}`,
        });

        slot.value = resolvedValue;
        component.update();
      },
    };

    component.hooks[index] = slot;

    emitDebugEvent({
      type: "useState:init",
      componentName,
      hookIndex: index,
      message: `[useState] ${componentName} hook[${index}] 초기화`,
    });
  }

  component.hookIndex += 1;
  return [slot.value, slot.setState];
}

// 기능: 의존성이 바뀌었을 때 렌더 후 효과를 실행하고 cleanup을 관리한다
// 입력: callback (Function) — 렌더 뒤 실행할 effect 함수
// 입력: deps (Array | undefined) — effect 재실행 여부를 판단할 의존성 배열
// 출력: 없음
export function useEffect(callback, deps) {
  const { component, index } = getHookContext();
  const componentName = getComponentName(component);
  let slot = component.hooks[index];

  if (slot === undefined) {
    slot = {
      deps: undefined,
      cleanup: null,
    };

    component.hooks[index] = slot;
  }

  if (hasDependenciesChanged(slot.deps, deps)) {
    const previousCleanup = slot.cleanup;

    slot.deps = cloneDependencies(deps);

    emitDebugEvent({
      type: "useEffect:schedule",
      componentName,
      hookIndex: index,
      message: `[useEffect 예약] ${componentName} hook[${index}]`,
    });

    scheduleAfterRender(() => {
      if (component.isUnmounted) {
        return;
      }

      if (typeof previousCleanup === "function") {
        emitDebugEvent({
          type: "useEffect:cleanup",
          componentName,
          hookIndex: index,
          message: `[useEffect cleanup] ${componentName} hook[${index}]`,
        });
        previousCleanup();
      }

      emitDebugEvent({
        type: "useEffect:run",
        componentName,
        hookIndex: index,
        message: `[useEffect 실행] ${componentName} hook[${index}]`,
      });

      const nextCleanup = callback();
      slot.cleanup = typeof nextCleanup === "function" ? nextCleanup : null;
    });
  }

  component.hookIndex += 1;
}

// 기능: 의존성이 유지되면 이전 계산값을 재사용하고 바뀌면 다시 계산한다
// 입력: fn (Function) — 메모이제이션할 계산 함수
// 입력: deps (Array | undefined) — 캐시 재사용 여부를 판단할 의존성 배열
// 출력: 계산 결과 값 (any)
export function useMemo(fn, deps) {
  const { component, index } = getHookContext();
  const componentName = getComponentName(component);
  let slot = component.hooks[index];

  if (slot === undefined) {
    const computedValue = fn();

    slot = {
      value: computedValue,
      deps: cloneDependencies(deps),
    };

    component.hooks[index] = slot;

    emitDebugEvent({
      type: "useMemo:compute",
      componentName,
      hookIndex: index,
      value: formatDebugValue(computedValue),
      message: `[useMemo 재계산] ${componentName} hook[${index}]`,
    });

    component.hookIndex += 1;
    return slot.value;
  }

  if (hasDependenciesChanged(slot.deps, deps)) {
    slot.value = fn();
    slot.deps = cloneDependencies(deps);

    emitDebugEvent({
      type: "useMemo:compute",
      componentName,
      hookIndex: index,
      value: formatDebugValue(slot.value),
      message: `[useMemo 재계산] ${componentName} hook[${index}]`,
    });
  } else {
    emitDebugEvent({
      type: "useMemo:cache-hit",
      componentName,
      hookIndex: index,
      value: formatDebugValue(slot.value),
      message: `[useMemo 캐시 사용] ${componentName} hook[${index}]`,
    });
  }

  component.hookIndex += 1;
  return slot.value;
}
