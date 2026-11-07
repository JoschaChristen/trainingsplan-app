import { useEffect, useRef, useState } from "react";
import { Minus, Pause, Play, Plus, X } from "lucide-react";
import { type Block, type Data } from "./model";
import {
  beepAt,
  blockTitle,
  clock,
  countdownSeconds,
  intervals,
  movementText,
  timerView,
  updateBlock,
} from "./blocks";
import { useAction } from "./ui";

type Stored = {
  blockId: string;
  startedAt: number;
  pausedAt?: number;
  pausedMs: number;
  rounds: number;
  stoppedAt?: number;
};
const key = "block-timer";

export function storedTimer(): Stored | undefined {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "null") ?? undefined;
  } catch {
    return undefined;
  }
}

let audio: AudioContext | undefined;
function beep(kind: "short" | "long") {
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator(),
      gain = audio.createGain(),
      length = kind === "long" ? 0.6 : 0.15;
    osc.frequency.value = kind === "long" ? 880 : 660;
    gain.gain.value = 0.3;
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + length);
  } catch {
    // No audio available: the vibration and the screen still show the beat.
  }
  navigator.vibrate?.(kind === "long" ? 400 : 120);
}

// Full-screen timer for a block. Its state lives in sessionStorage so a
// reload or a locked phone does not lose the running time.
export function BlockTimer({
  block: b,
  data,
  onClose,
}: {
  block: Block;
  data: Data;
  onClose: () => void;
}) {
  const { run } = useAction(),
    [state, setState] = useState<Stored>(() => {
      const s = storedTimer();
      return s?.blockId === b.id
        ? s
        : { blockId: b.id, startedAt: Date.now(), pausedMs: 0, rounds: 0 };
    }),
    [now, setNow] = useState(Date.now()),
    lastSecond = useRef<number>(undefined),
    movements = data.sessionExercises
      .filter((x) => x.blockId === b.id)
      .sort((a, c) => a.order - c.order);
  useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(state));
  }, [state]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    navigator.wakeLock
      ?.request("screen")
      .then((l) => (lock = l))
      .catch(() => {});
    return () => void lock?.release().catch(() => {});
  }, []);
  const end = state.stoppedAt ?? state.pausedAt ?? now,
    elapsed = (end - state.startedAt - state.pausedMs) / 1000,
    view = state.stoppedAt
      ? ({ phase: "done", elapsed: elapsed - countdownSeconds } as const)
      : timerView(b, elapsed),
    whole = Math.floor(elapsed);
  useEffect(() => {
    if (state.pausedAt || state.stoppedAt) return;
    if (lastSecond.current !== undefined && whole !== lastSecond.current) {
      const kind = beepAt(b, whole);
      if (kind) beep(kind);
    }
    lastSecond.current = whole;
  }, [whole, b, state.pausedAt, state.stoppedAt]);
  const done = view.phase === "done",
    paused = !!state.pausedAt,
    close = () => {
      sessionStorage.removeItem(key);
      onClose();
    },
    n = intervals(b),
    current =
      b.format === "emom" && b.alternate && movements.length > 1
        ? view.phase === "work" && view.interval
          ? [movements[(view.interval - 1) % movements.length]]
          : [movements[0]]
        : movements,
    capped = b.format === "for_time" && done && !state.stoppedAt,
    result: Partial<Block> =
      b.format === "emom"
        ? { scoreRounds: n }
        : b.format === "amrap"
          ? { scoreRounds: state.rounds }
          : capped
            ? { capped: true, scoreRounds: state.rounds }
            : {
                capped: false,
                scoreSeconds: Math.round(
                  view.phase === "done" ? view.elapsed : 0,
                ),
              },
    resultText =
      b.format === "emom"
        ? `${n}/${n} Intervalle`
        : b.format === "amrap" || capped
          ? `${capped ? "Timecap · " : ""}${state.rounds} ${state.rounds === 1 ? "Runde" : "Runden"}`
          : clock(Math.round(view.phase === "done" ? view.elapsed : 0));
  const big =
    view.phase === "countdown"
      ? String(Math.ceil(view.remaining))
      : view.phase === "done"
        ? "Fertig"
        : clock(
            Math.ceil(
              view.intervalRemaining ??
                (b.format === "amrap" ? view.remaining! : view.elapsed),
            ),
          );
  return (
    <div
      className={"block-timer " + view.phase}
      role="dialog"
      aria-label={`Timer ${blockTitle(b)}`}
    >
      <div className="row">
        <span className="eyebrow">{blockTitle(b)}</span>
        <button className="icon" aria-label="Timer schliessen" onClick={close}>
          <X />
        </button>
      </div>
      <span className="timer-label">
        {view.phase === "countdown"
          ? "Los in"
          : view.phase === "done"
            ? ""
            : b.format === "emom"
              ? `Intervall ${view.interval}/${n}`
              : b.format === "amrap"
                ? "Restzeit"
                : view.remaining !== undefined
                  ? `Timecap in ${clock(Math.ceil(view.remaining))}`
                  : "Zeit"}
      </span>
      <strong className="timer-big" aria-live="off">
        {big}
      </strong>
      {!done && (
        <ul className="timer-movements">
          {current.map((se) => {
            const e = data.exercises.find((x) => x.id === se.exerciseId);
            return (
              <li key={se.id}>
                <span>{e?.name}</span>
                <small>{e ? movementText(se, e.type) : ""}</small>
              </li>
            );
          })}
        </ul>
      )}
      {b.format !== "emom" && !(done && b.format === "for_time" && !capped) && (
        <div className="round-counter">
          <button
            className="icon"
            aria-label="Runde abziehen"
            disabled={!state.rounds}
            onClick={() =>
              setState((s) => ({ ...s, rounds: Math.max(0, s.rounds - 1) }))
            }
          >
            <Minus />
          </button>
          <span>
            <b>{state.rounds}</b>
            <small>{state.rounds === 1 ? "Runde" : "Runden"}</small>
          </span>
          <button
            className="round-plus"
            aria-label="Runde fertig"
            disabled={done || view.phase === "countdown"}
            onClick={() => setState((s) => ({ ...s, rounds: s.rounds + 1 }))}
          >
            <Plus /> Runde
          </button>
        </div>
      )}
      <div className="timer-actions">
        {done ? (
          <button
            className="primary"
            onClick={() =>
              void run(async () => {
                await updateBlock(b.id, result);
                close();
              })
            }
          >
            Übernehmen: {resultText}
          </button>
        ) : (
          <>
            <button
              className="outline"
              onClick={() =>
                setState((s) =>
                  s.pausedAt
                    ? {
                        ...s,
                        pausedAt: undefined,
                        pausedMs: s.pausedMs + Date.now() - s.pausedAt,
                      }
                    : { ...s, pausedAt: Date.now() },
                )
              }
            >
              {paused ? <Play size={18} /> : <Pause size={18} />}
              {paused ? "Weiter" : "Pause"}
            </button>
            {b.format === "for_time" && view.phase === "work" && (
              <button
                className="primary"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    stoppedAt: Date.now(),
                    pausedAt: undefined,
                    pausedMs:
                      s.pausedMs + (s.pausedAt ? Date.now() - s.pausedAt : 0),
                  }))
                }
              >
                Fertig
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
