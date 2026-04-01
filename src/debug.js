const debugListeners = new Set(); // mini-react 내부 이벤트를 구독할 리스너 모음

// 기능: mini-react 디버그 이벤트를 구독하고 해제 함수를 반환한다
// 입력: listener (Function) — 디버그 이벤트를 받을 콜백 함수
// 출력: 구독 해제 함수 (Function)
export function addDebugListener(listener) {
  debugListeners.add(listener);

  return function removeDebugListener() {
    debugListeners.delete(listener);
  };
}

// 기능: 등록된 모든 디버그 리스너에게 이벤트를 전달한다
// 입력: event (Object) — type, message, detail 등을 담은 디버그 이벤트 객체
// 출력: 타임스탬프가 포함된 최종 이벤트 객체 (Object)
export function emitDebugEvent(event) {
  const payload = {
    timestamp: Date.now(),
    ...event,
  };

  debugListeners.forEach((listener) => {
    listener(payload);
  });

  return payload;
}
