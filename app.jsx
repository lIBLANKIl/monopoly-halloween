/* global React, ReactDOM, useTweaks, TweaksPanel, TweakSection, TweakButton */
const { useState, useEffect, useRef, useCallback } = React;

const STORAGE_KEY = "juru_marble_v2";

// Ghost haunting: default chance (%) per roll that a ghost swaps the die face
// after it lands. Editable in EDIT mode and saved with the rest of the state.
const DEFAULT_GHOST_PCT = 10;
const MAX_GHOST_PCT = 20;
const GHOST_DELAY_MS = 1000; // pause after the die lands before the ghost shows up
const GHOST_SWAP_MS = 900;   // when the face flips during the swoop
const GHOST_TOTAL_MS = 2200; // swoop length; movement resumes after this

function loadState() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveState(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

// Boards saved before the start tile was pinned may have "출발" shuffled away
// from index 0. Swap it back so the saved board matches the current rules.
function pinStartCell(cells) {
  const startLabel = window.DEFAULT_CELLS[0].label;
  const i = cells.findIndex(c => c.label === startLabel);
  if (i <= 0) return cells;
  const next = [...cells];
  const displaced = { ...next[0], kind: next[0].kind === "start" ? "normal" : next[0].kind };
  next[0] = { ...next[i], kind: "start" };
  next[i] = displaced;
  return next;
}

function App() {
  const TWEAKS = /*EDITMODE-BEGIN*/{}/*EDITMODE-END*/;
  const [tweaks, setTweak] = useTweaks(TWEAKS);

  const [mode, setMode] = useState("play");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cells, setCells] = useState(() => {
    const saved = loadState();
    return (saved && saved.cells && pinStartCell(saved.cells)) || window.DEFAULT_CELLS.map(c => ({ ...c }));
  });
  const [pos, setPos] = useState(() => loadState()?.pos ?? 0);
  const [skip, setSkip] = useState(() => loadState()?.skip ?? 0);
  const [dieValue, setDieValue] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [ghostPct, setGhostPct] = useState(() => Math.min(MAX_GHOST_PCT, loadState()?.ghostPct ?? DEFAULT_GHOST_PCT));
  const [ghostWait, setGhostWait] = useState(false); // die landed, ghost about to appear
  const [ghost, setGhost] = useState(false); // ghost is haunting the die
  const [ghostKind, setGhostKind] = useState("swap"); // "swap" = face changes, "reverse" = same number, move backward
  const [reversed, setReversed] = useState(false); // die is cursed: badge shows backward move
  const [activeCell, setActiveCell] = useState(-1);
  const [tokenBouncing, setTokenBouncing] = useState(false);
  const [shufflingCells, setShufflingCells] = useState(false);
  const [modalCell, setModalCell] = useState(null);
  const [anywhereMode, setAnywhereMode] = useState(false);
  const [rouletteOpen, setRouletteOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [lastEvent, setLastEvent] = useState("");
  const [shufflePopup, setShufflePopup] = useState(null); // { remaining: number, onConfirm: fn } or null
  const animatingRef = useRef(false);
  // Always-current cells for async callbacks (movement timers outlive a board shuffle)
  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  useEffect(() => { saveState({ cells, pos, skip, ghostPct }); }, [cells, pos, skip, ghostPct]);

  const showToast = useCallback((text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const handleLanded = useCallback((cellIdx) => {
    const cell = cellsRef.current[cellIdx];
    if (!cell) return;
    setActiveCell(cellIdx);
    setLastEvent(`${cell.label} 도착`);

    if (cell.label.includes("랜덤")) {
      setRouletteOpen(true);
      return;
    }
    setModalCell(cell);
  }, []);

  // Shuffles every cell except index 0: the start tile stays put so "출발"
  // always remains the start tile.
  const shuffleCells = useCallback(() => {
    setCells(prev => {
      const rest = prev.slice(1);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      return [prev[0], ...rest];
    });
  }, []);

  // Movement flow:
  //   step → step → ... → if you hit "출발" with steps remaining,
  //   PAUSE, shuffle the board, then continue the rest of the move.
  //   Landing exactly on "출발" doesn't shuffle — it's just landing.
  const movePlayer = useCallback((steps, backward = false) => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    let stepsLeft = steps;
    let curr = pos;
    const total = window.TOTAL_CELLS;

    const tick = () => {
      if (stepsLeft <= 0) {
        animatingRef.current = false;
        setTokenBouncing(true);
        setTimeout(() => setTokenBouncing(false), 300);
        handleLanded(curr);
        return;
      }
      curr = backward ? (curr - 1 + total) % total : (curr + 1) % total;
      setPos(curr);
      setTokenBouncing(true);
      setTimeout(() => setTokenBouncing(false), 180);
      stepsLeft--;

      if (!backward && curr === 0 && stepsLeft > 0) {
        // Crossed 출발 with steps still to go → show popup, wait for confirm,
        // then shuffle and continue with remaining steps.
        const remaining = stepsLeft;
        setLastEvent(`출발 통과 → 셔플 안내 → 남은 ${remaining}칸 이어서 이동`);
        setShufflePopup({
          remaining,
          onConfirm: () => {
            setShufflePopup(null);
            setShufflingCells(true);
            shuffleCells();
            setTimeout(() => setShufflingCells(false), 800);
            // Resume movement once the shuffle visual settles
            setTimeout(tick, 950);
          },
        });
      } else {
        setTimeout(tick, 280);
      }
    };
    setTimeout(tick, 300);
  }, [pos, handleLanded, showToast, shuffleCells]);

  const rollDice = useCallback(() => {
    if (rolling || ghost || ghostWait || animatingRef.current) return;
    if (skip > 0) {
      setSkip(s => s - 1);
      showToast("한 턴 쉬어요 😴");
      setLastEvent("휴식 한 턴 소진");
      return;
    }
    setRolling(true);
    setReversed(false);
    // True per-call randomness. Math.random() is auto-seeded by the JS engine
    // with high entropy at startup; every call advances internal state.
    // We pre-roll the final value, then visually flicker through random faces
    // during the spin so the randomness is plainly visible.
    const finalVal = 1 + Math.floor(Math.random() * 6);
    const ROLL_MS = 1400;
    const TICK_MS = 70;
    let lastTick = -1;
    const ticker = setInterval(() => {
      // Avoid two identical consecutive ticks for a snappier feel
      let v = 1 + Math.floor(Math.random() * 6);
      if (v === lastTick) v = 1 + ((v) % 6);
      lastTick = v;
      setDieValue(v);
    }, TICK_MS);
    setTimeout(() => {
      clearInterval(ticker);
      setDieValue(finalVal);
      setRolling(false);
      // Low-probability haunting. Two variants:
      //   swap    — one ghost swoops in and changes the die face
      //   reverse — three ghosts circle the die; same number, but you move backward
      if (Math.random() * 100 < ghostPct) {
        const kind = Math.random() < 0.5 ? "swap" : "reverse";
        const swapped = 1 + ((finalVal + Math.floor(Math.random() * 5)) % 6); // always != finalVal
        setGhostKind(kind);
        setLastEvent(`🎲 ${finalVal}`);
        setGhostWait(true);
        setTimeout(() => {
          setGhostWait(false);
          setGhost(true);
        }, GHOST_DELAY_MS);
        setTimeout(() => {
          if (kind === "swap") {
            setDieValue(swapped);
            setLastEvent(`👻 유령이 주사위를 ${finalVal} → ${swapped}(으)로 바꿨다!`);
          } else {
            setReversed(true);
            setLastEvent(`👻 유령의 저주! ${finalVal}칸 뒤로 간다`);
          }
        }, GHOST_DELAY_MS + GHOST_SWAP_MS);
        setTimeout(() => {
          setGhost(false);
          if (kind === "swap") {
            movePlayer(swapped);
          } else {
            movePlayer(finalVal, true);
          }
        }, GHOST_DELAY_MS + GHOST_TOTAL_MS);
        return;
      }
      setLastEvent(`🎲 ${finalVal} 나왔다! 이동 시작`);
      // Optional debug — confirm randomness in DevTools console
      try { console.log("[dice] rolled", finalVal); } catch {}
      movePlayer(finalVal);
    }, ROLL_MS);
  }, [rolling, ghost, ghostWait, skip, ghostPct, movePlayer, showToast]);

  const closeModal = useCallback(() => {
    setModalCell(null);
    setAnywhereMode(false);
  }, []);

  const onAnywherePick = useCallback((idx) => {
    setPos(idx);
    setActiveCell(idx);
    setTokenBouncing(true);
    setTimeout(() => setTokenBouncing(false), 300);
    setLastEvent(`${cells[idx].label} 으로 텔레포트`);
    setModalCell(null);
    setAnywhereMode(false);
    if (cells[idx].kind === "rest") setSkip(1);
  }, [cells]);

  const closeRoulette = useCallback((picked) => {
    setRouletteOpen(false);
    if (picked) showToast(`🎰 ${picked}!`);
  }, [showToast]);

  // Full restart: token back to start, board back to the default cards.
  const resetGame = useCallback(() => {
    if (rolling || ghost || ghostWait || animatingRef.current) {
      showToast("이동 중에는 초기화할 수 없어요");
      return;
    }
    if (!window.confirm("판과 말 상태를 처음으로 초기화할까요?")) return;
    setPos(0); setSkip(0); setDieValue(1); setActiveCell(-1);
    setCells(window.DEFAULT_CELLS.map(c => ({ ...c })));
    setModalCell(null); setAnywhereMode(false); setRouletteOpen(false);
    setShufflePopup(null); setReversed(false);
    setLastEvent("");
    setSettingsOpen(false);
    showToast("처음부터 다시 시작!");
  }, [rolling, ghost, ghostWait, showToast]);

  const resetCellsToDefault = useCallback(() => {
    setCells(window.DEFAULT_CELLS.map(c => ({ ...c })));
    showToast("기본 미션으로 복구");
  }, [showToast]);

  const onCellClick = useCallback((idx) => {
    if (mode !== "play") return;
    setModalCell({ ...cells[idx], _preview: true });
    setActiveCell(idx);
  }, [mode, cells]);

  return (
    <div className={`app ${ghost ? "ghost-shake" : ""}`} data-screen-label={`01 ${mode === "play" ? "Play" : "Edit"}`}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">🎃</div>
          <div>
            <div className="brand-title">주<span className="accent">루</span>마블</div>
            <div className="brand-sub">Halloween Edition · Trick · Roll · Treat</div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="mode-tabs">
            <button className={`mode-tab ${mode === "play" ? "active" : ""}`} onClick={() => setMode("play")}>▶ PLAY</button>
            <button className={`mode-tab ${mode === "edit" ? "active" : ""}`} onClick={() => setMode("edit")}>✎ EDIT</button>
          </div>
          <div className="settings-wrap">
            <button className={`mode-tab settings-btn ${settingsOpen ? "active" : ""}`} onClick={() => setSettingsOpen(o => !o)} aria-label="설정">⚙ 설정</button>
            {settingsOpen && (
              <div className="settings-pop">
                <div className="settings-title">설정</div>
                <button className="btn btn-ghost settings-reset" onClick={resetGame}>↺ 처음부터 초기화</button>
                <div className="settings-hint">말은 출발로 돌아가고, 섞인 판은 기본 순서로 복구됩니다.</div>
              </div>
            )}
          </div>
        </div>
      </header>

      {mode === "play" ? (
        <div className="board-wrap">
          <div className="board">
            {cells.map((cell, idx) => {
              const [r, c] = window.SEQ_TO_RC[idx];
              return (
                <Cell
                  key={idx}
                  cell={cell}
                  idx={idx}
                  row={r}
                  col={c}
                  isActive={idx === activeCell}
                  hasToken={pos === idx}
                  tokenBouncing={tokenBouncing && pos === idx}
                  shuffling={shufflingCells}
                  onClick={() => onCellClick(idx)}
                />
              );
            })}
            <CenterHub
              rolling={rolling}
              ghost={ghost}
              ghostKind={ghostKind}
              reversed={reversed}
              ghostWait={ghostWait}
              dieValue={dieValue}
              onRoll={rollDice}
              canRoll={!rolling && !ghost && !ghostWait && !modalCell && !rouletteOpen && !animatingRef.current}
              lastEvent={lastEvent}
              skipTurns={skip}
            />
          </div>
        </div>
      ) : (
        <EditMode cells={cells} setCells={setCells} onResetDefaults={resetCellsToDefault} ghostPct={ghostPct} setGhostPct={setGhostPct} />
      )}

      <MissionModal
        cell={modalCell && !modalCell._preview ? modalCell : null}
        anywhereMode={anywhereMode}
        cells={cells}
        onAnywherePick={onAnywherePick}
        onClose={closeModal}
      />
      {modalCell && modalCell._preview && (
        <div className="modal-backdrop" onClick={() => setModalCell(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-eyebrow">미리보기 · {modalCell.kind}</div>
            <h2 className="modal-headline">{modalCell.label}</h2>
            {modalCell.sub && <div style={{ color: "var(--neon-cyan)", fontSize: 13, fontFamily: "JetBrains Mono, monospace" }}>{modalCell.sub}</div>}
            <p className="modal-body">실제 도착 시 미션이 진행됩니다.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setModalCell(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      <RouletteModal
        open={rouletteOpen}
        missions={window.RANDOM_MISSIONS}
        onResult={closeRoulette}
        onClose={() => closeRoulette(null)}
      />

      <ShufflePopup popup={shufflePopup} />

      {(ghostWait || ghost) && (
        <div className={`haunt-overlay ${ghost ? "on" : "wait"}`} aria-hidden="true">
          {ghost && <div className="haunt-flash" />}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      <TweaksPanel title="Tweaks">
        <TweakSection title="게임">
          <TweakButton label="게임 초기화" onClick={resetGame} />
          <TweakButton label="미션 기본값 복구" onClick={resetCellsToDefault} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
