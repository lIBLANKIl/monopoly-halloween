/* global React */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

function uid() { return Math.random().toString(36).slice(2, 9); }

// ---------- Cell ----------
function Cell({ cell, idx, row, col, isActive, hasToken, tokenBouncing, shuffling, onClick }) {
  return (
    <div
      className={`cell ${cell.kind !== "normal" ? "kind-" + cell.kind : ""} ${idx % 7 === 0 ? "corner" : ""} ${isActive ? "is-active" : ""} ${shuffling ? "shuffling" : ""}`}
      style={{ gridRow: row, gridColumn: col, animationDelay: shuffling ? `${(idx * 18) % 400}ms` : "0ms" }}
      onClick={onClick}
    >
      <div className="cell-idx">{String(idx).padStart(2, "0")}</div>
      <div className="cell-label">{cell.label}</div>
      {cell.sub && <div className="cell-sub">{cell.sub}</div>}
      {hasToken && (
        <div className="cell-tokens">
          <div className={`token-piece ${tokenBouncing ? "bouncing" : ""}`} aria-label="플레이어 말">🎃</div>
        </div>
      )}
    </div>
  );
}

// ---------- 3D Dice ----------
function Dice3D({ value, rolling, ghost, ghostWait, ghostKind, reversed }) {
  // Build dice faces with proper pip layouts
  const pipPositions = {
    1: [[2, 2]],
    2: [[1, 1], [3, 3]],
    3: [[1, 1], [2, 2], [3, 3]],
    4: [[1, 1], [1, 3], [3, 1], [3, 3]],
    5: [[1, 1], [1, 3], [2, 2], [3, 1], [3, 3]],
    6: [[1, 1], [1, 3], [2, 1], [2, 3], [3, 1], [3, 3]],
  };
  const Face = ({ n, className }) => (
    <div className={`dice-face face-${n} ${className || ""}`}>
      {pipPositions[n].map(([r, c], i) => (
        <div key={i} className="dice-pip" style={{ gridRow: r, gridColumn: c }} />
      ))}
    </div>
  );
  return (
    <div className={`dice-area ${ghost ? "haunted" : ""} ${ghostWait ? "haunt-lift" : ""}`}>
      <div className="dice-stage">
        <div className={`dice-3d ${rolling ? "rolling" : `land-${value}`}`}>
          <Face n={1} />
          <Face n={2} />
          <Face n={3} />
          <Face n={4} />
          <Face n={5} />
          <Face n={6} />
        </div>
        <div className={`dice-shadow ${rolling ? "rolling" : ""}`} />
        {ghost && ghostKind === "swap" && (
          <>
            <div className="dice-ghost" aria-hidden="true">👻</div>
            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
              <span key={i} className="dice-spark" style={{ "--a": `${i * 45}deg` }} aria-hidden="true">✨</span>
            ))}
          </>
        )}
        {ghost && ghostKind === "reverse" && (
          <>
            {[0, 120, 240].map(a => (
              <div key={a} className="dice-ghost orbit" style={{ "--a": `${a}deg` }} aria-hidden="true">👻</div>
            ))}
          </>
        )}
      </div>
      <div className={`dice-value-badge ${rolling ? "is-rolling" : ""}`} aria-live="polite">
        <span className="dice-value-num">{reversed ? `◀ ${value}` : value}</span>
      </div>
    </div>
  );
}

// ---------- Center hub ----------
function CenterHub({ rolling, ghost, ghostWait, ghostKind, reversed, dieValue, onRoll, canRoll, lastEvent, skipTurns }) {
  return (
    <div className="center-hub">
      <div className="hub-title">
        <div className="row1">TRICK · ROLL · TREAT</div>
        <div className="row2">주루마블</div>
      </div>

      <Dice3D value={dieValue} rolling={rolling} ghost={ghost} ghostWait={ghostWait} ghostKind={ghostKind} reversed={reversed} />

      <button className="btn btn-primary btn-roll" onClick={onRoll} disabled={!canRoll}>
        {rolling ? "굴리는 중…" : skipTurns > 0 ? `한 턴 쉬기 (${skipTurns})` : "주사위 굴리기"}
      </button>
      <div className={`hub-status ${lastEvent && lastEvent.startsWith("👻") ? "is-ghost" : ""}`}>{lastEvent || "주사위를 굴려 시작"}</div>
    </div>
  );
}

// ---------- Mission Modal ----------
function MissionModal({ cell, onClose, onAnywherePick, anywhereMode, cells }) {
  if (!cell) return null;
  const eyebrow = ({
    start: "출발 통과",
    rest: "한 턴 휴식",
    bomb: "폭탄 미션",
    anywhere: "원하는 곳으로",
    normal: "미션",
  })[cell.kind];

  if (anywhereMode) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(720px, 94vw)" }}>
          <div className="modal-eyebrow">{eyebrow}</div>
          <h2 className="modal-headline">어느 칸으로 갈까?</h2>
          <p className="modal-body">아래 칸 중 원하는 곳을 선택하세요.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
            {cells.map((c, i) => (
              <button key={i} className="btn btn-ghost" style={{ padding: "10px 8px", fontSize: 11, textAlign: "left", lineHeight: 1.3 }} onClick={() => onAnywherePick(i)}>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, color: "var(--ink-mute)" }}>{String(i).padStart(2, "0")}</div>
                <div style={{ fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>{c.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-eyebrow">{eyebrow}</div>
        <h2 className="modal-headline">{cell.label}</h2>
        {cell.sub && <div style={{ color: "var(--neon-cyan)", fontSize: 13, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.05em" }}>{cell.sub}</div>}
        <p className="modal-body">{cell.description || cellDescription(cell)}</p>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>완료</button>
        </div>
      </div>
    </div>
  );
}

function cellDescription(cell) {
  switch (cell.kind) {
    case "start": return "출발 칸을 통과/도착했어요. 보너스를 즐기세요.";
    case "rest":  return "다음 차례를 한 번 쉬어가요.";
    case "bomb":  return "폭탄주 한 잔을 제조하세요.";
    case "anywhere": return "원하는 칸 어디로든 이동할 수 있어요.";
    default: return "미션을 수행하세요!";
  }
}

// ---------- Shuffle Popup (announces the board shuffle) ----------
function ShufflePopup({ popup }) {
  if (!popup) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal modal-shuffle" onClick={(e) => e.stopPropagation()}>
        <div className="modal-eyebrow">BOARD SHUFFLE</div>
        <h2 className="modal-headline">보드 셔플 진행!</h2>
        <p className="modal-body">
          <b style={{ color: "var(--neon-pink)" }}>출발</b>을 통과했습니다.
          출발 칸을 제외한 모든 미션 카드가 다시 섞입니다.
          섞기가 끝나면 남은 <b style={{ color: "var(--neon-cyan)" }}>{popup.remaining}칸</b>을 이어서 이동합니다.
        </p>
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={popup.onConfirm}>섞기 시작 ✨</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Roulette ----------
function RouletteModal({ open, missions, onResult, onClose }) {
  const [phase, setPhase] = useState("idle");
  const [pick, setPick] = useState(null);
  const trackRef = useRef(null);

  useEffect(() => {
    if (!open) { setPhase("idle"); setPick(null); }
  }, [open]);

  const spin = () => {
    if (phase === "spinning") return;
    setPhase("spinning");
    setPick(null);
    const choiceIdx = Math.floor(Math.random() * missions.length);
    const choice = missions[choiceIdx];
    const track = trackRef.current;
    if (track) {
      track.style.transition = "none";
      track.style.transform = "translateX(0)";
      void track.offsetWidth;
      // Land the chosen item (in a later repeat of the list) exactly under the marker.
      const item = track.children[4 * missions.length + choiceIdx];
      const viewport = track.parentElement;
      const trackLeft = track.getBoundingClientRect().left;
      const itemRect = item.getBoundingClientRect();
      const itemCenter = itemRect.left - trackLeft + itemRect.width / 2;
      const jitter = (Math.random() - 0.5) * itemRect.width * 0.5; // stay within the item
      const distance = itemCenter - viewport.clientWidth / 2 + jitter;
      track.style.transition = "transform 2400ms cubic-bezier(0.15, 0.8, 0.2, 1)";
      track.style.transform = `translateX(-${distance}px)`;
    }
    setTimeout(() => { setPick(choice); setPhase("done"); }, 2500);
  };

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={phase === "done" ? onClose : null}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-eyebrow">랜덤 게임 룰렛</div>
        <h2 className="modal-headline">{pick || "?????"}</h2>
        <div className="roulette">
          <div className="roulette-track" ref={trackRef}>
            {Array.from({ length: 6 }).flatMap((_, k) =>
              missions.map((m, i) => <div key={`${k}-${i}`} className="roulette-item">{m}</div>)
            )}
          </div>
          <div className="roulette-marker" />
        </div>
        <div className="modal-actions">
          {phase === "idle" && <button className="btn btn-primary" onClick={spin}>룰렛 돌리기</button>}
          {phase === "spinning" && <button className="btn btn-primary" disabled>돌리는 중…</button>}
          {phase === "done" && (
            <>
              <button className="btn btn-ghost" onClick={spin}>다시</button>
              <button className="btn btn-primary" onClick={() => onResult(pick)}>이걸로!</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Edit mode ----------
function EditMode({ cells, setCells, onResetDefaults, ghostPct, setGhostPct }) {
  const cycleKind = (i) => {
    const kinds = ["normal", "start", "rest", "bomb", "anywhere"];
    setCells(prev => prev.map((c, j) => j === i ? { ...c, kind: kinds[(kinds.indexOf(c.kind) + 1) % kinds.length] } : c));
  };
  const updateField = (i, key, val) => {
    setCells(prev => prev.map((c, j) => j === i ? { ...c, [key]: val } : c));
  };
  return (
    <div>
      <div className="edit-toolbar">
        <div className="edit-toolbar-info">
          미션 칸을 자유롭게 수정하세요. 종류 칩을 클릭해 칸 종류를 바꿀 수 있어요. 총 <b>{cells.length}</b>칸.
        </div>
        <button className="btn btn-ghost" onClick={onResetDefaults}>기본값으로 복구</button>
      </div>
      <div className="edit-toolbar">
        <div className="edit-toolbar-info">
          👻 유령이 주사위 눈을 바꿀 확률 <b>{ghostPct}%</b> (0이면 끄기, 최대 20%)
        </div>
        <input
          type="range" min="0" max="20" step="1"
          value={ghostPct}
          onChange={(e) => setGhostPct(Number(e.target.value))}
          style={{ flex: "0 1 260px", accentColor: "var(--neon-pink)" }}
        />
      </div>
      <div className="edit-grid">
        {cells.map((c, i) => (
          <div key={i} className="edit-cell">
            <div className="edit-cell-head">
              <div className="edit-cell-idx">CELL {String(i).padStart(2, "0")}</div>
              <button className="edit-kind-pill" onClick={() => cycleKind(i)} title="클릭하여 종류 변경">{c.kind}</button>
            </div>
            <input className="edit-input" value={c.label} onChange={(e) => updateField(i, "label", e.target.value)} placeholder="미션 제목" />
            <textarea className="edit-textarea" value={c.sub || ""} onChange={(e) => updateField(i, "sub", e.target.value)} placeholder="설명 (선택)" />
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Cell, CenterHub, MissionModal, RouletteModal, ShufflePopup, EditMode });
