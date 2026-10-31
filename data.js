// 28-cell square board on an 8x8 grid (4*8 - 4 = 28 perimeter cells, perfect fit)
// Layout indices:
//   top row    (row 1, cols 1..8):              indices 0..7   (8 cells)
//   right col  (col 8, rows 2..8):              indices 8..14  (7 cells, last is bottom-right corner)
//   bottom row (row 8, cols 7..1, right→left):  indices 15..21 (7 cells, last is bottom-left corner)
//   left col   (col 1, rows 7..2, bottom→top):  indices 22..27 (6 cells)
// Total: 8 + 7 + 7 + 6 = 28

window.BOARD_GRID_SIZE = 8;

// Cell kinds drive color & special behavior
//   start    — passing/landing grants reward
//   rest     — skip next turn (1회 휴식)
//   bomb     — heavy mission
//   anywhere — choose any cell to move to
//   normal   — regular mission
window.DEFAULT_CELLS = [
  // ----- TOP ROW (left → right) -----
  { kind: "start",    label: "출발",       sub: "통과 시 +1잔" },
  { kind: "normal",   label: "혼자 마셔",  sub: "" },
  { kind: "normal",   label: "적립주",     sub: "" },
  { kind: "normal",   label: "랜덤 게임",  sub: "🎰" },
  { kind: "normal",   label: "나 빼고 원샷", sub: "" },
  { kind: "normal",   label: "본인이 시작하는 랜덤 게임", sub: "" },
  { kind: "normal",   label: "주사위 한 번 더", sub: "🎲" },
  { kind: "normal",   label: "혼자 마셔",  sub: "" },
  { kind: "normal",   label: "무인도",     sub: "1회 휴식" },

  // ----- RIGHT COLUMN (top → bottom, excluding corners) -----
  { kind: "normal",   label: "24학번 이상 마셔", sub: "" },
  { kind: "normal",   label: "랜덤 게임",  sub: "🎰" },
  { kind: "normal",   label: "작년에 활동했던 사람 마셔", sub: "" },
  { kind: "normal",   label: "랜덤 게임",  sub: "🎰" },
  { kind: "normal",   label: "좌1우1해제",  sub: "" },
  { kind: "normal",   label: "1명 지목",   sub: "(너 마셔!)" },
  { kind: "normal",   label: "주사위 한 번 더", sub: "🎲" },

  // ----- BOTTOM ROW (right → left) -----
  { kind: "normal",   label: "25학번 이하 마셔", sub: "" },
  { kind: "normal",   label: "랜덤 게임",  sub: "🎰" },
  { kind: "normal",   label: "1명 지목",   sub: "(너 마셔!)" },
  { kind: "normal",   label: "본인이 시작하는 랜덤 게임", sub: "" },
  { kind: "normal",   label: "랜덤 게임",  sub: "🎰" },
  { kind: "normal",   label: "폭탄주 마시기", sub: "없으면 쉬어가기" },
  { kind: "normal",   label: "적립주 마셔", sub: "" },
  { kind: "normal",   label: "전국 노래자랑", sub: "(못하면 두잔)" },

  // ----- LEFT COLUMN (bottom → top, excluding corners) -----
  { kind: "bomb",     label: "폭탄주",     sub: "1잔 제조" },
  { kind: "normal",   label: "좌1우1",      sub: "" },
  { kind: "normal",   label: "랜덤 게임",  sub: "🎰" },
  { kind: "normal",   label: "이번학기 신입부원 마셔", sub: "" },
];

// Random mission pool used by "랜덤 게임" cells (roulette)
window.RANDOM_MISSIONS = [
  "딸기게임",
  "딸기당근수박참외메론",
  "바니바니",
  "두부게임",
  "지하철게임",
  "홍삼게임",
  "호빵찐빵대빵",
  "세글자게임",
  "어목조동",
  "훈민정음",
  "오렌지",
  "손병호",
  "더게임오브데스",
  "베스킨라빈스31",
  "공산당",
  "눈치게임",
];

// Player palette (token colors, neon)
window.PLAYER_COLORS = [
  "oklch(0.74 0.22 350)",  // pink
  "oklch(0.85 0.15 200)",  // cyan
  "oklch(0.9 0.18 95)",    // yellow
  "oklch(0.72 0.2 305)",   // violet
  "oklch(0.88 0.2 135)",   // lime
  "oklch(0.78 0.2 45)",    // orange
  "oklch(0.8 0.18 240)",   // blue
  "oklch(0.85 0.18 0)",    // red
];

window.DEFAULT_NAMES = ["민수", "지연", "현우", "수빈", "태형", "예진", "동현", "하늘"];

// Map sequence index (0..27) → (row, col) on 8x8 grid (1-indexed)
window.SEQ_TO_RC = (() => {
  const N = window.BOARD_GRID_SIZE; // 8
  const out = [];
  // top row: row 1, cols 1..N
  for (let c = 1; c <= N; c++) out.push([1, c]);
  // right col: col N, rows 2..N (includes bottom-right corner)
  for (let r = 2; r <= N; r++) out.push([r, N]);
  // bottom row: row N, cols N-1..1 (right→left, excludes bottom-right which was added)
  for (let c = N - 1; c >= 1; c--) out.push([N, c]);
  // left col: col 1, rows N-1..2 (bottom→top, excludes both corners)
  for (let r = N - 1; r >= 2; r--) out.push([r, 1]);
  return out;
})();

window.TOTAL_CELLS = window.SEQ_TO_RC.length; // 28
