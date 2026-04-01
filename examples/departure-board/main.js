import {
  FunctionComponent,
  addDebugListener,
  h,
  useEffect,
  useMemo,
  useState,
} from "../../src/index.js";

const MINUTE = 60 * 1000; // 분 계산에 사용할 밀리초 상수
const SECOND = 1000; // 초 계산에 사용할 밀리초 상수
const BOARDING_WINDOW = 10 * MINUTE; // 출발 10분 전부터 BOARDING으로 바뀌는 기준 시간
const DEBUG_LIMIT = 18; // 화면에 유지할 디버그 이벤트 개수 제한
const FILTER_ALL = "ALL"; // 상태 필터에서 전체 보기를 나타내는 값
const STATUS_MENU_WIDTH = 124; // 상태 필터 팝오버 고정 폭

const STATUS_LABELS = {
  SCHEDULED: "SCHEDULED",
  BOARDING: "BOARDING",
  DELAYED: "DELAYED",
  DEPARTED: "DEPARTED",
}; // 상태 코드를 화면에 그대로 보여주기 위한 문자열 모음

const STATUS_DISPLAY_LABELS = {
  SCHEDULED: "정시",
  BOARDING: "탑승 안내",
  DELAYED: "지연",
  DEPARTED: "출발 완료",
}; // 내부 상태 코드를 전광판에서 보여줄 한국어 문구로 바꾸는 사전

const STATUS_FILTER_OPTIONS = [
  { value: FILTER_ALL, label: "전체" },
  { value: STATUS_LABELS.SCHEDULED, label: STATUS_DISPLAY_LABELS.SCHEDULED },
  { value: STATUS_LABELS.BOARDING, label: STATUS_DISPLAY_LABELS.BOARDING },
  { value: STATUS_LABELS.DELAYED, label: STATUS_DISPLAY_LABELS.DELAYED },
  { value: STATUS_LABELS.DEPARTED, label: STATUS_DISPLAY_LABELS.DEPARTED },
]; // 상태 필터 select에 그대로 넣을 옵션 목록

const counterNodes = {
  render: document.getElementById("counter-render"),
  update: document.getElementById("counter-update"),
  setState: document.getElementById("counter-setstate"),
  effect: document.getElementById("counter-effect"),
  memo: document.getElementById("counter-memo"),
  lastEvent: document.getElementById("last-event"),
}; // Hook Debug Panel에서 숫자 카운터를 갱신할 DOM 참조 모음

const debugFeedNode = document.getElementById("hook-event-feed"); // 최근 디버그 이벤트를 보여줄 로그 리스트
const appContainer = document.getElementById("app"); // mini-react 앱을 마운트할 루트 DOM 노드

const debugMetrics = {
  render: 0,
  update: 0,
  setState: 0,
  effect: 0,
  memo: 0,
}; // 코어 훅 이벤트가 몇 번 발생했는지 누적할 카운터 저장소

const debugEntries = []; // Hook Debug Panel에 표시할 최근 이벤트 기록

let serviceSequence = 410; // 새 편성을 만들 때 번호를 붙이기 위한 증가 카운터

// 기능: 날짜를 datetime-local input이 이해할 문자열로 바꾼다
// 입력: date (Date) — input 기본값으로 넣을 로컬 날짜 객체
// 출력: YYYY-MM-DDTHH:mm 형식 문자열 (string)
function formatDateTimeInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// 기능: 현재 시각에서 offsetMinutes만큼 뒤의 시간을 datetime-local 문자열로 만든다
// 입력: offsetMinutes (number) — 현재 시각에 더할 분 수
// 출력: datetime-local input용 문자열 (string)
function getFutureDateTimeValue(offsetMinutes) {
  return formatDateTimeInputValue(new Date(Date.now() + offsetMinutes * MINUTE));
}

// 기능: 전광판에서 보여줄 현재 시각 문자열을 만든다
// 입력: timestamp (number) — 표시할 기준 시각의 밀리초 값
// 출력: HH:MM:SS 형식 문자열 (string)
function formatClock(timestamp) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

// 기능: 전광판 행에 들어갈 출발 시각 문자열을 만든다
// 입력: timestamp (number) — 표시할 출발 시각의 밀리초 값
// 출력: HH:MM 형식 문자열 (string)
function formatBoardTime(timestamp) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

// 기능: 전광판 상태 코드를 사용자에게 보여줄 한국어 문구로 바꾼다
// 입력: status (string) — 내부 상태 코드 문자열
// 출력: 화면에 출력할 상태 문구 (string)
function getStatusDisplayLabel(status) {
  return STATUS_DISPLAY_LABELS[status] || status;
}

// 기능: 상태 필터 값에 맞는 화면용 한국어 라벨을 돌려준다
// 입력: statusFilter (string) — ALL 또는 내부 상태 코드 문자열
// 출력: 상태 필터 UI에 보여줄 문구 (string)
function getStatusFilterLabel(statusFilter) {
  if (statusFilter === FILTER_ALL) {
    return "전체";
  }

  return getStatusDisplayLabel(statusFilter);
}

// 기능: 상태 값에 맞는 톤 이름을 반환한다
// 입력: status (string) — ALL 또는 내부 상태 코드 문자열
// 출력: CSS class suffix로 쓸 톤 이름 (string)
function getToneName(status) {
  if (status === FILTER_ALL) {
    return "all";
  }

  return String(status).toLowerCase();
}

// 기능: 상태 필터 팝오버의 fixed 위치 스타일 문자열을 만든다
// 입력: position (Object) — top, left 숫자를 가진 메뉴 위치 객체
// 출력: inline style 문자열 (string)
function getStatusMenuStyle(position) {
  return `position:fixed;top:${position.top}px;left:${position.left}px;z-index:2147483647;`;
}

// 기능: 항공편과 열차편에 사용할 식별 코드를 만든다
// 입력: kind (string) — FLIGHT 또는 TRAIN 중 하나인 편성 종류
// 출력: 보기 쉬운 서비스 코드 문자열 (string)
function createServiceCode(kind) {
  serviceSequence += 1;

  if (kind === "TRAIN") {
    return `TR-${serviceSequence}`;
  }

  return `FL-${serviceSequence}`;
}

// 기능: 새로 추가할 편성 입력 폼의 기본값을 만든다
// 입력: 없음
// 출력: kind, destination, gate, departureAt, delayMinutes를 담은 객체 (Object)
function createInitialFormState() {
  return {
    kind: "FLIGHT",
    destination: "Tokyo Haneda",
    gate: "A3",
    departureAt: getFutureDateTimeValue(26),
    delayMinutes: "0",
  };
}

// 기능: 첫 화면에 보여줄 샘플 편성 목록을 만든다
// 입력: nowTimestamp (number) — 현재 시각 기준 밀리초 값
// 출력: 초기 편성 배열 (Array)
function createSeedDepartures(nowTimestamp) {
  const baseTime = new Date(nowTimestamp);

  return [
    {
      id: "seed-flight-1",
      kind: "FLIGHT",
      serviceCode: "FL-401",
      destination: "Osaka Itami",
      gate: "A1",
      departureAt: formatDateTimeInputValue(new Date(baseTime.getTime() + 24 * MINUTE)),
      delayMinutes: 0,
      manualStatus: "AUTO",
    },
    {
      id: "seed-train-1",
      kind: "TRAIN",
      serviceCode: "TR-402",
      destination: "Busan Station",
      gate: "7B",
      departureAt: formatDateTimeInputValue(new Date(baseTime.getTime() + 7 * MINUTE)),
      delayMinutes: 0,
      manualStatus: "AUTO",
    },
    {
      id: "seed-flight-2",
      kind: "FLIGHT",
      serviceCode: "FL-403",
      destination: "Taipei Songshan",
      gate: "B4",
      departureAt: formatDateTimeInputValue(new Date(baseTime.getTime() + 18 * MINUTE)),
      delayMinutes: 15,
      manualStatus: "AUTO",
    },
    {
      id: "seed-train-2",
      kind: "TRAIN",
      serviceCode: "TR-404",
      destination: "Daejeon",
      gate: "5A",
      departureAt: formatDateTimeInputValue(new Date(baseTime.getTime() - 4 * MINUTE)),
      delayMinutes: 0,
      manualStatus: "AUTO",
    },
  ];
}

// 기능: 편성에 실제 반영될 출발 시각을 밀리초로 계산한다
// 입력: departure (Object) — departureAt과 delayMinutes를 가진 편성 객체
// 출력: 지연이 반영된 출발 시각 밀리초 값 (number)
function getEffectiveDepartureTimestamp(departure) {
  return new Date(departure.departureAt).getTime() + departure.delayMinutes * MINUTE;
}

// 기능: 현재 시각 기준으로 편성 상태를 계산한다
// 입력: departure (Object) — 상태를 계산할 편성 객체
// 입력: currentTime (number) — 현재 시각 밀리초 값
// 출력: SCHEDULED, BOARDING, DELAYED, DEPARTED 중 하나의 상태 문자열 (string)
function getDepartureStatus(departure, currentTime) {
  const effectiveDeparture = getEffectiveDepartureTimestamp(departure);
  const remainingMs = effectiveDeparture - currentTime;

  if (departure.manualStatus === STATUS_LABELS.DEPARTED) {
    return STATUS_LABELS.DEPARTED;
  }

  if (currentTime >= effectiveDeparture) {
    return STATUS_LABELS.DEPARTED;
  }

  if (departure.delayMinutes > 0) {
    return STATUS_LABELS.DELAYED;
  }

  if (departure.manualStatus === STATUS_LABELS.BOARDING) {
    return STATUS_LABELS.BOARDING;
  }

  if (remainingMs <= BOARDING_WINDOW) {
    return STATUS_LABELS.BOARDING;
  }

  return STATUS_LABELS.SCHEDULED;
}

// 기능: 남은 시간을 전광판에서 읽기 쉬운 문자열로 만든다
// 입력: effectiveDeparture (number) — 지연이 반영된 출발 시각 밀리초 값
// 입력: currentTime (number) — 현재 시각 밀리초 값
// 입력: status (string) — 현재 편성 상태 문자열
// 출력: 전광판에 출력할 남은 시간 문자열 (string)
function formatRemainingTime(effectiveDeparture, currentTime, status) {
  if (status === STATUS_LABELS.DEPARTED) {
    return "출발 완료";
  }

  const diff = Math.max(0, effectiveDeparture - currentTime);
  const minutes = Math.floor(diff / MINUTE);
  const seconds = Math.floor((diff % MINUTE) / SECOND);

  return `${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

// 기능: 편성 한 줄을 전광판에서 바로 렌더링할 수 있는 파생 데이터로 바꾼다
// 입력: departure (Object) — 원본 편성 객체
// 입력: currentTime (number) — 현재 시각 밀리초 값
// 출력: 화면 표시용 편성 row 객체 (Object)
function createBoardRow(departure, currentTime) {
  const effectiveDeparture = getEffectiveDepartureTimestamp(departure);
  const status = getDepartureStatus(departure, currentTime);

  return {
    ...departure,
    status,
    statusLabel: getStatusDisplayLabel(status),
    effectiveDeparture,
    boardTime: formatBoardTime(effectiveDeparture),
  };
}

// 기능: 전광판 row를 출발 시각이 빠른 순서로 정렬한다
// 입력: left (Object) — 왼쪽 비교 대상 row
// 입력: right (Object) — 오른쪽 비교 대상 row
// 출력: 정렬 우선순위를 나타내는 숫자 (number)
function sortBoardRows(left, right) {
  return left.effectiveDeparture - right.effectiveDeparture;
}

// 기능: 전광판에 표시할 rows와 상태별 카운트를 한 번에 계산한다
// 입력: departures (Array) — 원본 편성 배열
// 입력: currentTime (number) — 현재 시각 밀리초 값
// 입력: statusFilter (string) — 전광판 select에 걸린 현재 상태 필터 값
// 출력: 전체 rows, 필터 rows, 상태별 카운트를 담은 객체 (Object)
function createBoardView(departures, currentTime, statusFilter) {
  const allRows = departures
    .map((departure) => createBoardRow(departure, currentTime))
    .sort(sortBoardRows);

  const counts = {
    [FILTER_ALL]: allRows.length,
    [STATUS_LABELS.SCHEDULED]: 0,
    [STATUS_LABELS.BOARDING]: 0,
    [STATUS_LABELS.DELAYED]: 0,
    [STATUS_LABELS.DEPARTED]: 0,
  };

  allRows.forEach((row) => {
    counts[row.status] += 1;
  });

  const filteredRows =
    statusFilter === FILTER_ALL
      ? allRows
      : allRows.filter((row) => row.status === statusFilter);

  return {
    allRows,
    filteredRows,
    counts,
    activeToneName: getToneName(statusFilter),
    activeFilterLabel: getStatusFilterLabel(statusFilter),
  };
}

// 기능: Hook Debug Panel 숫자 카운터를 DOM에 반영한다
// 입력: 없음
// 출력: 없음
function renderDebugCounters() {
  counterNodes.render.textContent = String(debugMetrics.render);
  counterNodes.update.textContent = String(debugMetrics.update);
  counterNodes.setState.textContent = String(debugMetrics.setState);
  counterNodes.effect.textContent = String(debugMetrics.effect);
  counterNodes.memo.textContent = String(debugMetrics.memo);
}

// 기능: 디버그 로그 목록을 최신순으로 다시 그린다
// 입력: 없음
// 출력: 없음
function renderDebugFeed() {
  debugFeedNode.replaceChildren();

  debugEntries.forEach((entry) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    const detail = document.createElement("span");
    const meta = document.createElement("small");

    item.className = "event-item";
    title.textContent = `[${entry.source}] ${entry.label}`;
    detail.textContent = entry.detail;
    meta.textContent = entry.time;

    item.appendChild(title);
    item.appendChild(detail);
    item.appendChild(meta);
    debugFeedNode.appendChild(item);
  });
}

// 기능: Hook Debug Panel에 새 이벤트를 기록하고 콘솔에도 함께 남긴다
// 입력: source (string) — 이벤트 출처 이름
// 입력: label (string) — 짧은 이벤트 제목
// 입력: detail (string) — 자세한 설명 문구
// 출력: 없음
function recordDebugEntry(source, label, detail) {
  const time = formatClock(Date.now());

  debugEntries.unshift({
    source,
    label,
    detail,
    time,
  });

  debugEntries.splice(DEBUG_LIMIT);
  counterNodes.lastEvent.textContent = label;
  renderDebugFeed();
  console.log(`[${source}] ${label} :: ${detail}`);
}

// 기능: 코어 mini-react 이벤트 타입에 맞춰 디버그 카운터를 증가시킨다
// 입력: eventType (string) — emitDebugEvent에서 전달한 type 문자열
// 출력: 없음
function incrementDebugMetric(eventType) {
  if (eventType === "render:start") {
    debugMetrics.render += 1;
  }

  if (eventType === "update:start") {
    debugMetrics.update += 1;
  }

  if (eventType === "useState:set") {
    debugMetrics.setState += 1;
  }

  if (eventType === "useEffect:run") {
    debugMetrics.effect += 1;
  }

  if (eventType === "useMemo:compute") {
    debugMetrics.memo += 1;
  }
}

// 기능: 코어 mini-react 디버그 이벤트를 사람이 읽기 쉬운 로그로 바꾼다
// 입력: event (Object) — mini-react core가 전달한 디버그 이벤트 객체
// 출력: 없음
function handleCoreDebugEvent(event) {
  incrementDebugMetric(event.type);
  renderDebugCounters();
  recordDebugEntry("mini-react", event.message, `${event.componentName || "App"} / ${event.type}`);
}

// 기능: Hook Debug Panel을 초기화하고 코어 디버그 리스너를 등록한다
// 입력: 없음
// 출력: 없음
function setupDebugPanel() {
  renderDebugCounters();
  recordDebugEntry(
    "guide",
    "Hook Debug Panel 준비",
    "이제 render, setState, useEffect, useMemo 흐름이 아래 목록에 쌓입니다."
  );
  addDebugListener(handleCoreDebugEvent);
}

// 기능: 상태 텍스트를 색상 배지 형태의 VNode로 만든다
// 입력: status (string) — SCHEDULED, BOARDING, DELAYED, DEPARTED 중 하나의 상태 문자열
// 입력: statusLabel (string) — 상태를 보여줄 한국어 문구
// 출력: 상태 배지 VNode (Object)
function StatusBadge({ status, statusLabel }) {
  return h(
    "span",
    {
      className: `status-badge status-${status.toLowerCase()}`,
    },
    statusLabel
  );
}

// 기능: 전광판 표 헤더 한 칸을 만든다
// 입력: label (string) — 헤더에 보여줄 문자열
// 입력: hookLabel (string) — 헤더 아래에 붙일 보조 라벨
// 출력: th VNode (Object)
function TableHeadCell({ label, hookLabel }) {
  return h(
    "th",
    null,
    label,
    hookLabel ? h("small", null, hookLabel) : null
  );
}

// 기능: 상태 헤더 안에서 필터 버튼만 렌더링한다
// 입력: isStatusFilterOpen (boolean) — 필터 패널이 열려 있는지 여부
// 입력: onToggleStatusFilter (Function) — 필터 패널 열림/닫힘 토글 핸들러
// 출력: 상태 헤더 th VNode (Object)
function StatusFilterHeadCell({
  isStatusFilterOpen,
  onToggleStatusFilter,
}) {
  return h(
    "th",
    { className: "status-filter-head" },
    h(
      "div",
      { className: "status-filter-title-row" },
      h("span", null, "상태"),
      h(
        "button",
        {
          type: "button",
          className: `filter-toggle-button ${isStatusFilterOpen ? "is-open" : ""}`,
          onClick(event) {
            onToggleStatusFilter(event);
          },
        },
        h("span", { className: "filter-svg-icon", "aria-hidden": "true" })
      )
    ),
    h("small", null, "useMemo")
  );
}

// 기능: 상태 필터 메뉴를 fixed 오버레이로 렌더링한다
// 입력: isStatusFilterOpen (boolean) — 필터 메뉴가 열려 있는지 여부
// 입력: statusFilter (string) — 현재 선택된 상태 필터 값
// 입력: menuPosition (Object) — fixed 좌표 top, left
// 입력: onStatusFilterChange (Function) — 상태 필터 변경 핸들러
// 출력: 팝오버 VNode 또는 null (Object | null)
function StatusFilterOverlay({
  isStatusFilterOpen,
  statusFilter,
  menuPosition,
  onStatusFilterChange,
}) {
  if (!isStatusFilterOpen) {
    return null;
  }

  return h(
    "div",
    {
      className: "status-filter-popover",
      style: getStatusMenuStyle(menuPosition),
    },
    ...STATUS_FILTER_OPTIONS.map((option) => {
      const isSelected = option.value === statusFilter;

      return h(
        "button",
        {
          key: option.value,
          type: "button",
          className: `filter-menu-item ${isSelected ? "is-selected" : ""}`,
          onClick() {
            onStatusFilterChange(option.value);
          },
        },
        h("span", { className: "filter-menu-check" }, isSelected ? "✓" : ""),
        h("span", { className: "filter-menu-label" }, option.label)
      );
    })
  );
}

// 기능: 전광판 계산 요약에서 상태별 숫자 하나를 한 줄 항목으로 만든다
// 입력: label (string) — 예: 전체, 정시, 지연
// 입력: count (number) — 해당 상태 개수
// 입력: toneName (string) — 숫자 강조색에 쓸 CSS 톤 이름
// 출력: 한 줄 요약 항목 VNode (Object)
function SummaryMetric({ label, count, toneName }) {
  return h(
    "span",
    { className: "summary-metric" },
    `${label} `,
    h("strong", { className: `summary-count tone-${toneName}` }, String(count)),
    "건"
  );
}

// 기능: 운영 패널의 편성 카드 한 장을 렌더링한다
// 입력: row (Object) — 운영 패널에서 보여줄 편성 row
// 입력: onAddDelay ~ onRemoveDeparture (Function) — 카드 액션 버튼에 연결할 이벤트 핸들러
// 출력: 편성 카드 VNode (Object)
function RegisteredDepartureCard({
  row,
  currentTime,
  onAddDelay,
  onClearDelay,
  onForceBoarding,
  onReturnToAuto,
  onForceDeparted,
  onRemoveDeparture,
}) {
  return h(
    "article",
    { className: "admin-card", key: row.serviceCode },
    h(
      "div",
      { className: "admin-card-head" },
      h("h4", { className: "admin-card-title" }, `${row.serviceCode} / ${row.destination}`),
      h(StatusBadge, { status: row.status, statusLabel: row.statusLabel })
    ),
    h(
      "p",
      { className: "admin-meta" },
      `${row.boardTime} 출발 / Gate ${row.gate} / 남은 시간 ${formatRemainingTime(row.effectiveDeparture, currentTime, row.status)} / 수동 상태 ${row.manualStatus}`
    ),
    h(
      "div",
      { className: "admin-actions" },
      h(
        "button",
        {
          type: "button",
          className: "ghost-button",
          onClick: onAddDelay.bind(null, row.id),
        },
        "+5분 지연"
      ),
      h(
        "button",
        {
          type: "button",
          className: "ghost-button",
          onClick: onClearDelay.bind(null, row.id),
        },
        "지연 해제"
      ),
      h(
        "button",
        {
          type: "button",
          className: "ghost-button",
          onClick: onForceBoarding.bind(null, row.id),
        },
        "수동 탑승 안내"
      ),
      h(
        "button",
        {
          type: "button",
          className: "ghost-button",
          disabled: row.manualStatus === "AUTO",
          onClick: onReturnToAuto.bind(null, row.id),
        },
        "자동 판정"
      ),
      h(
        "button",
        {
          type: "button",
          className: "ghost-button",
          onClick: onForceDeparted.bind(null, row.id),
        },
        "즉시 출발"
      ),
      h(
        "button",
        {
          type: "button",
          className: "ghost-button",
          onClick: onRemoveDeparture.bind(null, row.id),
        },
        "삭제"
      )
    )
  );
}

// 기능: 운영 패널 아래에 현재 등록된 편성 목록을 렌더링한다
// 입력: rows (Array) — 운영 패널 카드로 보여줄 편성 row 배열
// 입력: 각 액션 핸들러 (Function) — 카드 버튼에 연결할 이벤트 핸들러 모음
// 출력: 편성 목록 VNode (Object)
function RegisteredDeparturesList({
  rows,
  currentTime,
  onAddDelay,
  onClearDelay,
  onForceBoarding,
  onReturnToAuto,
  onForceDeparted,
  onRemoveDeparture,
}) {
  if (!rows.length) {
    return h("p", { className: "admin-empty" }, "등록된 편성이 없습니다. 왼쪽 폼에서 첫 편성을 추가해보세요.");
  }

  return h(
    "div",
    { className: "admin-list" },
    ...rows.map((row) => {
      return h(RegisteredDepartureCard, {
        key: row.serviceCode,
        row,
        currentTime,
        onAddDelay,
        onClearDelay,
        onForceBoarding,
        onReturnToAuto,
        onForceDeparted,
        onRemoveDeparture,
      });
    })
  );
}

// 기능: 운영 패널의 입력 폼만 별도 자식 컴포넌트로 렌더링한다
// 입력: form (Object) — 입력 폼 상태
// 입력: onFieldChange (Function) — 폼 입력 변경 핸들러
// 입력: onAddDeparture (Function) — 새 편성 추가 버튼 핸들러
// 출력: 폼 VNode (Object)
function ControlForm({ form, onFieldChange, onAddDeparture }) {
  return h(
    "div",
    { className: "form-grid" },
    h(
      "div",
      { className: "field-row" },
      h(
        "label",
        null,
        "운송 수단",
        h(
          "select",
          {
            value: form.kind,
            onInput(event) {
              onFieldChange("kind", event.target.value);
            },
          },
          h("option", { value: "FLIGHT" }, "항공편"),
          h("option", { value: "TRAIN" }, "열차편")
        )
      ),
      h(
        "label",
        null,
        "게이트 / 승강장",
        h("input", {
          type: "text",
          value: form.gate,
          placeholder: "A3 / 7B",
          onInput(event) {
            onFieldChange("gate", event.target.value);
          },
        })
      )
    ),
    h(
      "label",
      null,
      "목적지",
      h("input", {
        type: "text",
        value: form.destination,
        placeholder: "Tokyo Haneda / Busan Station",
        onInput(event) {
          onFieldChange("destination", event.target.value);
        },
      })
    ),
    h(
      "div",
      { className: "field-row field-row-tight" },
      h(
        "label",
        null,
        "출발 시각",
        h("input", {
          type: "datetime-local",
          value: form.departureAt,
          onInput(event) {
            onFieldChange("departureAt", event.target.value);
          },
        })
      ),
      h(
        "label",
        { className: "compact-field" },
        "지연(분)",
        h("input", {
          type: "number",
          min: "0",
          value: form.delayMinutes,
          onInput(event) {
            onFieldChange("delayMinutes", event.target.value);
          },
        })
      )
    ),
    h(
      "button",
      {
        type: "button",
        className: "primary-button",
        onClick: onAddDeparture,
      },
      "새로운 편성 추가"
    )
  );
}

// 기능: 운영 패널 전체를 자식 컴포넌트로 렌더링한다
// 입력: form (Object) — 입력 폼 상태
// 입력: registeredRows (Array) — 운영 패널 아래에 보여줄 편성 row 배열
// 입력: 각 입력/버튼 핸들러 (Function) — 폼과 편성 액션을 위한 함수
// 출력: 운영 패널 VNode (Object)
function ControlPanel({
  form,
  registeredRows,
  currentTime,
  onFieldChange,
  onAddDeparture,
  onAddDelay,
  onClearDelay,
  onForceBoarding,
  onReturnToAuto,
  onForceDeparted,
  onRemoveDeparture,
}) {
  return h(
    "aside",
    { className: "control-panel" },
    h(
      "div",
      { className: "section-header" },
      h("div", null, h("h2", null, "운영 패널 / Control Panel"))
    ),
    h(ControlForm, {
      form,
      onFieldChange,
      onAddDeparture,
    }),
    h(
      "div",
      { className: "registered-shell" },
      h(
        "div",
        { className: "section-header" },
        h("div", null, h("h3", null, "현재 등록된 편성"))
      ),
      h(RegisteredDeparturesList, {
        rows: registeredRows,
        currentTime,
        onAddDelay,
        onClearDelay,
        onForceBoarding,
        onReturnToAuto,
        onForceDeparted,
        onRemoveDeparture,
      })
    )
  );
}

// 기능: 전광판 상단 툴바를 별도 자식 컴포넌트로 렌더링한다
// 입력: currentTime (number) — 현재 시각 칩에 표시할 밀리초 값
// 입력: counts (Object) — 상태별 개수 요약 데이터
// 입력: statusFilter (string) — 현재 선택된 상태 필터 값
// 입력: activeToneName (string) — 현재 활성 필터에 맞는 강조색 이름
// 입력: filteredRows (Array) — 현재 필터가 적용된 전광판 row 배열
// 출력: 상단 툴바 VNode (Object)
function BoardToolbar({
  currentTime,
  counts,
  statusFilter,
  activeToneName,
  filteredRows,
}) {
  return h(
    "div",
    { className: "board-summary" },
    h(
      "div",
      { className: "board-summary-chip" },
      h("span", { className: "board-summary-label" }, "현재 시각 · useState + useEffect"),
      h("strong", { className: "board-summary-value" }, formatClock(currentTime))
    ),
    h(
      "div",
      { className: "board-summary-chip board-calculation-chip" },
      h("span", { className: "board-summary-label" }, "전광판 계산"),
      h(
        "div",
        { className: "board-summary-line" },
        h(SummaryMetric, { label: "전체", count: counts[FILTER_ALL], toneName: "all" }),
        h(SummaryMetric, {
          label: STATUS_DISPLAY_LABELS.SCHEDULED,
          count: counts[STATUS_LABELS.SCHEDULED],
          toneName: "scheduled",
        }),
        h(SummaryMetric, {
          label: STATUS_DISPLAY_LABELS.BOARDING,
          count: counts[STATUS_LABELS.BOARDING],
          toneName: "boarding",
        }),
        h(SummaryMetric, {
          label: STATUS_DISPLAY_LABELS.DELAYED,
          count: counts[STATUS_LABELS.DELAYED],
          toneName: "delayed",
        }),
        h(SummaryMetric, {
          label: STATUS_DISPLAY_LABELS.DEPARTED,
          count: counts[STATUS_LABELS.DEPARTED],
          toneName: "departed",
        })
      ),
      h(
        "span",
        { className: "board-filter-note" },
        "현재 보기 ",
        h("strong", { className: `tone-${activeToneName}` }, getStatusFilterLabel(statusFilter)),
        " / ",
        h("strong", { className: `tone-${activeToneName}` }, String(filteredRows.length)),
        "건"
      )
    )
  );
}

// 기능: 출발 전광판 표 본문을 자식 컴포넌트로 렌더링한다
// 입력: rows (Array) — 전광판에서 보여줄 편성 row 배열
// 입력: statusFilter (string) — 현재 선택된 상태 필터 값
// 입력: isStatusFilterOpen (boolean) — 상태 필터 패널이 열려 있는지 여부
// 입력: onToggleStatusFilter (Function) — 상태 필터 패널 토글 핸들러
// 입력: onStatusFilterChange (Function) — 상태 필터 변경 핸들러
// 출력: 전광판 표 VNode (Object)
function DepartureList({
  rows,
  currentTime,
  statusFilter,
  isStatusFilterOpen,
  onToggleStatusFilter,
  onStatusFilterChange,
}) {
  return h(
    "div",
    { className: "board-table-wrap" },
    h(
      "div",
      { className: "board-table-scroll" },
      h(
        "table",
        null,
        h(
          "thead",
          null,
          h(
            "tr",
            null,
            h(TableHeadCell, { label: "편명/열차", hookLabel: "props" }),
            h(TableHeadCell, { label: "출발 시각", hookLabel: "props" }),
            h(TableHeadCell, { label: "목적지", hookLabel: "props" }),
            h(TableHeadCell, { label: "게이트", hookLabel: "props" }),
            h(StatusFilterHeadCell, {
              isStatusFilterOpen,
              onToggleStatusFilter,
            }),
            h(TableHeadCell, { label: "남은 시간", hookLabel: "함수 계산" })
          )
        ),
        h(
          "tbody",
          null,
          ...(rows.length
            ? rows.map((row) => {
                return h(
                  "tr",
                  { key: row.serviceCode },
                  h("td", null, row.serviceCode),
                  h("td", null, row.boardTime),
                  h("td", { className: "destination-cell" }, row.destination),
                  h("td", null, row.gate),
                  h("td", null, h(StatusBadge, { status: row.status, statusLabel: row.statusLabel })),
                  h("td", null, formatRemainingTime(row.effectiveDeparture, currentTime, row.status))
                );
              })
            : [
                h(
                  "tr",
                  { key: "empty-state" },
                  h(
                    "td",
                    { colSpan: "6", className: "empty-row" },
                    "선택한 상태에 해당하는 편성이 없습니다."
                  )
                ),
              ])
        )
      )
    )
  );
}

// 기능: 전광판 패널 전체를 자식 컴포넌트로 렌더링한다
// 입력: currentTime (number) — 상단 현재 시각에 보여줄 밀리초 값
// 입력: statusFilter (string) — 현재 선택된 상태 필터 값
// 입력: isStatusFilterOpen (boolean) — 상태 필터 패널이 열려 있는지 여부
// 입력: statusFilterMenuPosition (Object) — 상태 필터 패널의 fixed 좌표
// 입력: counts (Object) — 상태별 개수 요약 데이터
// 입력: filteredRows (Array) — 필터가 적용된 전광판 row 배열
// 입력: activeToneName (string) — 현재 활성 필터에 맞는 강조색 이름
// 입력: onToggleStatusFilter (Function) — 상태 필터 패널 토글 핸들러
// 입력: onStatusFilterChange (Function) — 필터 select 변경 핸들러
// 출력: 전광판 패널 VNode (Object)
function BoardScreen({
  currentTime,
  statusFilter,
  isStatusFilterOpen,
  statusFilterMenuPosition,
  counts,
  filteredRows,
  activeToneName,
  onToggleStatusFilter,
  onStatusFilterChange,
}) {
  return h(
    "section",
    { className: "board-panel" },
    h(
      "div",
      { className: "board-header" },
      h("h2", { className: "board-title" }, "출발 전광판"),
      h(BoardToolbar, {
        currentTime,
        counts,
        statusFilter,
        activeToneName,
        filteredRows,
      })
    ),
    h(DepartureList, {
      rows: filteredRows,
      currentTime,
      statusFilter,
      isStatusFilterOpen,
      onToggleStatusFilter,
      onStatusFilterChange,
    }),
    h(StatusFilterOverlay, {
      isStatusFilterOpen,
      statusFilter,
      menuPosition: statusFilterMenuPosition,
      onStatusFilterChange,
    })
  );
}

// 기능: 출발 전광판 앱 전체를 렌더링한다
// 입력: 없음
// 출력: 전체 화면을 표현하는 루트 VNode (Object)
function DepartureBoardApp() {
  const [departures, setDepartures] = useState(createSeedDepartures(Date.now()));
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [form, setForm] = useState(createInitialFormState());
  const [statusFilter, setStatusFilter] = useState(FILTER_ALL);
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const [statusFilterMenuPosition, setStatusFilterMenuPosition] = useState({ top: 0, left: 0 });

  // 기능: 1초마다 현재 시간을 갱신하는 타이머를 등록한다
  // 입력: 없음
  // 출력: interval을 정리하는 cleanup 함수 (Function)
  function registerClockTicker() {
    recordDebugEntry(
      "app",
      "[useEffect] 1초 타이머 등록",
      "currentTime 상태를 매초 갱신해서 BOARDING/DEPARTED 판정을 자동으로 움직입니다."
    );

    const intervalId = setInterval(() => {
      setCurrentTime(Date.now());
    }, SECOND);

    return function cleanupClockTicker() {
      recordDebugEntry(
        "app",
        "[useEffect] 타이머 cleanup",
        "페이지를 떠나거나 컴포넌트가 정리될 때 interval을 해제합니다."
      );
      clearInterval(intervalId);
    };
  }

  useEffect(registerClockTicker, []);

  const boardView = useMemo(() => {
    return createBoardView(departures, currentTime, statusFilter);
  }, [departures, currentTime, statusFilter]);

  // 기능: 입력 폼 한 칸의 값을 바꾼다
  // 입력: field (string) — 변경할 필드 이름
  // 입력: value (string) — 새로 저장할 필드 값
  // 출력: 없음
  function updateFormField(field, value) {
    setForm((currentForm) => {
      return {
        ...currentForm,
        [field]: value,
      };
    });
  }

  // 기능: 전광판 상태 필터 값을 바꾼다
  // 입력: nextFilter (string) — ALL 또는 상태 코드 문자열
  // 출력: 없음
  function handleStatusFilterChange(nextFilter) {
    recordDebugEntry(
      "app",
      "상태 필터 변경",
      `${getStatusFilterLabel(nextFilter)} 항목만 보도록 전광판 화면을 다시 계산합니다.`
    );
    setStatusFilter(nextFilter);
    setIsStatusFilterOpen(false);
  }

  // 기능: 상태 헤더 안의 필터 패널 열림/닫힘을 토글한다
  // 입력: 없음
  // 출력: 없음
  function handleToggleStatusFilter(event) {
    if (isStatusFilterOpen) {
      setIsStatusFilterOpen(false);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const nextLeft = Math.max(
      8,
      Math.min(window.innerWidth - STATUS_MENU_WIDTH - 8, rect.left)
    );

    setStatusFilterMenuPosition({
      top: rect.bottom + 6,
      left: nextLeft,
    });
    setIsStatusFilterOpen(true);
  }

  // 기능: 편성 목록에서 id가 일치하는 항목만 업데이트한다
  // 입력: departureId (string) — 수정할 편성의 id
  // 입력: updater (Function) — 편성 객체를 받아 새 편성 객체를 반환하는 함수
  // 출력: 없음
  function updateDepartureById(departureId, updater) {
    setDepartures((currentDepartures) => {
      return currentDepartures.map((departure) => {
        if (departure.id !== departureId) {
          return departure;
        }

        return updater(departure);
      });
    });
  }

  // 기능: 입력 폼 값을 읽어서 새 항공편 또는 열차편을 등록한다
  // 입력: 없음
  // 출력: 없음
  function handleAddDeparture() {
    const destination = form.destination.trim();
    const gate = form.gate.trim();

    if (!destination || !gate || !form.departureAt) {
      recordDebugEntry(
        "app",
        "편성 추가 실패",
        "목적지, 게이트, 출발 시간을 모두 입력해야 새 편성을 추가할 수 있습니다."
      );
      return;
    }

    recordDebugEntry(
      "app",
      "새 편성 추가",
      `${form.kind} / ${destination} / 게이트 ${gate} 편성을 등록합니다.`
    );

    setDepartures((currentDepartures) => {
      return currentDepartures.concat({
        id: `${form.kind.toLowerCase()}-${Date.now()}`,
        kind: form.kind,
        serviceCode: createServiceCode(form.kind),
        destination,
        gate,
        departureAt: form.departureAt,
        delayMinutes: Number(form.delayMinutes) || 0,
        manualStatus: "AUTO",
      });
    });

    setForm({
      ...createInitialFormState(),
      kind: form.kind,
      destination: "",
      gate: "",
      departureAt: getFutureDateTimeValue(32),
    });
  }

  // 기능: 선택한 편성의 지연 시간을 5분 더 늘린다
  // 입력: departureId (string) — 지연을 늘릴 편성의 id
  // 출력: 없음
  function handleAddDelay(departureId) {
    recordDebugEntry(
      "app",
      "지연 시간 +5분",
      `${departureId} 편성의 delayMinutes를 5분 늘립니다.`
    );

    updateDepartureById(departureId, (departure) => {
      return {
        ...departure,
        delayMinutes: departure.delayMinutes + 5,
      };
    });
  }

  // 기능: 선택한 편성의 지연 시간을 0으로 되돌린다
  // 입력: departureId (string) — 지연을 해제할 편성의 id
  // 출력: 없음
  function handleClearDelay(departureId) {
    recordDebugEntry(
      "app",
      "지연 해제",
      `${departureId} 편성의 delayMinutes를 0으로 되돌립니다.`
    );

    updateDepartureById(departureId, (departure) => {
      return {
        ...departure,
        delayMinutes: 0,
      };
    });
  }

  // 기능: 선택한 편성을 수동 BOARDING 상태로 바꾼다
  // 입력: departureId (string) — BOARDING으로 표시할 편성의 id
  // 출력: 없음
  function handleForceBoarding(departureId) {
    recordDebugEntry(
      "app",
      "수동 BOARDING",
      `${departureId} 편성을 시간과 무관하게 BOARDING으로 표시합니다.`
    );

    updateDepartureById(departureId, (departure) => {
      return {
        ...departure,
        manualStatus: STATUS_LABELS.BOARDING,
      };
    });
  }

  // 기능: 선택한 편성을 수동 DEPARTED 상태로 바꾼다
  // 입력: departureId (string) — 출발 완료로 표시할 편성의 id
  // 출력: 없음
  function handleForceDeparted(departureId) {
    recordDebugEntry(
      "app",
      "즉시 출발 처리",
      `${departureId} 편성을 수동으로 DEPARTED 상태에 둡니다.`
    );

    updateDepartureById(departureId, (departure) => {
      return {
        ...departure,
        manualStatus: STATUS_LABELS.DEPARTED,
      };
    });
  }

  // 기능: 선택한 편성의 수동 상태를 AUTO로 되돌린다
  // 입력: departureId (string) — 수동 상태를 해제할 편성의 id
  // 출력: 없음
  function handleReturnToAuto(departureId) {
    recordDebugEntry(
      "app",
      "AUTO 복귀",
      `${departureId} 편성의 manualStatus를 AUTO로 돌려 자동 판정에 맡깁니다.`
    );

    updateDepartureById(departureId, (departure) => {
      return {
        ...departure,
        manualStatus: "AUTO",
      };
    });
  }

  // 기능: 선택한 편성을 목록에서 삭제한다
  // 입력: departureId (string) — 삭제할 편성의 id
  // 출력: 없음
  function handleRemoveDeparture(departureId) {
    recordDebugEntry(
      "app",
      "편성 삭제",
      `${departureId} 편성을 전광판과 제어 패널 목록에서 제거합니다.`
    );

    setDepartures((currentDepartures) => {
      return currentDepartures.filter((departure) => departure.id !== departureId);
    });
  }

  return h(
    "section",
    { className: "layout-grid" },
    h(ControlPanel, {
      form,
      registeredRows: boardView.allRows,
      currentTime,
      onFieldChange: updateFormField,
      onAddDeparture: handleAddDeparture,
      onAddDelay: handleAddDelay,
      onClearDelay: handleClearDelay,
      onForceBoarding: handleForceBoarding,
      onReturnToAuto: handleReturnToAuto,
      onForceDeparted: handleForceDeparted,
      onRemoveDeparture: handleRemoveDeparture,
    }),
    h(BoardScreen, {
      currentTime,
      statusFilter,
      isStatusFilterOpen,
      statusFilterMenuPosition,
      counts: boardView.counts,
      filteredRows: boardView.filteredRows,
      activeToneName: boardView.activeToneName,
      onToggleStatusFilter: handleToggleStatusFilter,
      onStatusFilterChange: handleStatusFilterChange,
    })
  );
}

// 기능: 루트 FunctionComponent를 만들고 전광판 앱을 첫 렌더링한다
// 입력: 없음
// 출력: 없음
function mountDepartureBoard() {
  setupDebugPanel();
  const app = new FunctionComponent(DepartureBoardApp, {}, appContainer);

  app.mount();
}

mountDepartureBoard();
