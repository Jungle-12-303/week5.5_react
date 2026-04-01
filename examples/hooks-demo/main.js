import {
  FunctionComponent,
  h,
  useEffect,
  useMemo,
  useState,
} from "../../src/index.js";

const container = document.getElementById("app"); // 루트 컴포넌트를 붙일 DOM 컨테이너
const effectLog = document.getElementById("effect-log"); // effect 실행 결과를 보여줄 안내 문구
const renderCountNode = document.getElementById("render-count"); // 렌더 횟수를 표시할 디버그 숫자 노드
const memoCountNode = document.getElementById("memo-count"); // memo 재계산 횟수를 표시할 디버그 숫자 노드
const effectCountNode = document.getElementById("effect-count"); // effect 실행 횟수를 표시할 디버그 숫자 노드
const lastActionNode = document.getElementById("last-action"); // 마지막 사용자 조작을 보여줄 디버그 문구 노드

let renderCount = 0; // 루트 컴포넌트가 실제로 몇 번 렌더됐는지 누적 기록
let memoRecomputeCount = 0; // useMemo 계산 함수가 몇 번 실행됐는지 누적 기록
let effectRunCount = 0; // useEffect 콜백이 몇 번 실행됐는지 누적 기록
let lastAction = "초기 렌더"; // 방금 어떤 조작이 있었는지 보여줄 문구

// 기능: 요약 정보를 카드 형태의 순수 자식 컴포넌트로 렌더링한다
// 입력: props (Object) — label, value, description을 담은 표시용 props
// 출력: 카드 UI를 나타내는 VNode (Object)
function SummaryCard(props) {
  return h(
    "article",
    { className: "summary-card" },
    h("strong", null, props.label),
    h("span", null, props.value),
    h("p", null, props.description)
  );
}

// 기능: 현재 디버그 카운터와 마지막 조작 문구를 화면에 반영한다
// 입력: 없음
// 출력: 없음
function updateDebugPanel() {
  renderCountNode.textContent = String(renderCount);
  memoCountNode.textContent = String(memoRecomputeCount);
  effectCountNode.textContent = String(effectRunCount);
  lastActionNode.textContent = lastAction;
}

// 기능: count와 step 상태를 함께 관리하는 루트 데모 화면을 만든다
// 입력: 없음
// 출력: 데모 전체 UI를 나타내는 VNode (Object)
function DashboardApp() {
  renderCount += 1;

  const [count, setCount] = useState(0);
  const [step, setStep] = useState(1);
  const [tone, setTone] = useState("calm");

  const summary = useMemo(() => {
    memoRecomputeCount += 1;

    return {
      parityLabel: count % 2 === 0 ? "짝수" : "홀수",
      nextCount: count + step,
      distanceFromZero: Math.abs(count),
      direction: count === 0 ? "원점" : count > 0 ? "양수" : "음수",
    };
  }, [count, step]);

  useEffect(() => {
    effectRunCount += 1;

    const message = `마지막 effect 실행: count=${count}, step=${step}`;

    effectLog.textContent = message;
    document.title = `mini-react hooks demo (${count})`;
    updateDebugPanel();
  }, [count, step]);

  return h(
    "section",
    { className: `demo-shell tone-${tone}` },
    h("span", { className: "eyebrow" }, "Hooks Layer"),
    h("h2", { className: "headline" }, `현재 count는 ${count}입니다.`),
    h(
      "p",
      { className: "subcopy" },
      "count와 step은 memo와 effect에 연결돼 있고, 테마 전환은 렌더만 다시 일으킵니다. 그래서 같은 state라도 어떤 훅이 같이 움직이는지 눈으로 분리해서 볼 수 있습니다."
    ),
    h(
      "div",
      { className: "control-row" },
      h(
        "button",
        {
          type: "button",
          onClick: () => {
            lastAction = `count를 ${step}만큼 증가`;
            setCount((currentCount) => currentCount + step);
          },
        },
        `+${step} 증가`
      ),
      h(
        "button",
        {
          type: "button",
          onClick: () => {
            lastAction = `count를 ${step}만큼 감소`;
            setCount((currentCount) => currentCount - step);
          },
        },
        `-${step} 감소`
      ),
      h(
        "button",
        {
          type: "button",
          onClick: () => {
            lastAction = "count를 두 배로 변경";
            setCount((currentCount) => currentCount * 2);
          },
        },
        "두 배로"
      ),
      h(
        "button",
        {
          type: "button",
          onClick: () => {
            lastAction = "count를 0으로 초기화";
            setCount(0);
          },
        },
        "초기화"
      ),
      h(
        "button",
        {
          type: "button",
          onClick: () => {
            lastAction = "테마만 전환";
            setTone((currentTone) => {
              return currentTone === "calm" ? "bold" : "calm";
            });
          },
        },
        `테마 전환 (${tone})`
      )
    ),
    h(
      "div",
      { className: "step-row" },
      h(
        "button",
        {
          type: "button",
          className: "step-button",
          onClick: () => {
            lastAction = "step을 1로 변경";
            setStep(1);
          },
        },
        "step 1"
      ),
      h(
        "button",
        {
          type: "button",
          className: "step-button",
          onClick: () => {
            lastAction = "step을 2로 변경";
            setStep(2);
          },
        },
        "step 2"
      ),
      h(
        "button",
        {
          type: "button",
          className: "step-button",
          onClick: () => {
            lastAction = "step을 5로 변경";
            setStep(5);
          },
        },
        "step 5"
      )
    ),
    h(
      "div",
      { className: "card-grid" },
      h(SummaryCard, {
        label: "다음 count",
        value: String(summary.nextCount),
        description: "지금 버튼을 한 번 더 누르면 도달할 값입니다.",
      }),
      h(SummaryCard, {
        label: "짝수/홀수",
        value: summary.parityLabel,
        description: "useMemo가 count 변화에 맞춰 다시 계산한 결과입니다.",
      }),
      h(SummaryCard, {
        label: "원점 거리",
        value: String(summary.distanceFromZero),
        description: "음수든 양수든 0에서 얼마나 떨어졌는지 보여줍니다.",
      }),
      h(SummaryCard, {
        label: "방향",
        value: summary.direction,
        description: "현재 값이 양수, 음수, 또는 원점인지 표시합니다.",
      })
    )
  );
}

// 기능: FunctionComponent의 mount와 update 뒤에 디버그 패널을 갱신하도록 감싼다
// 입력: app (FunctionComponent) — 데모에서 사용할 루트 컴포넌트 인스턴스
// 출력: 감싼 뒤 같은 인스턴스 (FunctionComponent)
function wrapWithDebugUpdates(app) {
  const originalMount = app.mount.bind(app);
  const originalUpdate = app.update.bind(app);

  app.mount = () => {
    const result = originalMount();
    updateDebugPanel();
    return result;
  };

  app.update = () => {
    const result = originalUpdate();
    updateDebugPanel();
    return result;
  };

  return app;
}

// 기능: 루트 FunctionComponent를 만들고 데모를 첫 렌더링한다
// 입력: 없음
// 출력: 없음
function mountDemo() {
  const app = wrapWithDebugUpdates(
    new FunctionComponent(DashboardApp, {}, container)
  );
  app.mount();
}

mountDemo();
