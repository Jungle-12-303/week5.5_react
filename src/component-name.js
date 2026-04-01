// 기능: 디버그 로그와 내부 추적에 사용할 컴포넌트 이름을 안전하게 만든다
// 입력: component (Object) — fn 프로퍼티를 가진 FunctionComponent 인스턴스
// 출력: 사람이 읽기 쉬운 컴포넌트 이름 (string)
export function getComponentName(component) {
  return component.fn?.name || "AnonymousComponent";
}
