import { useState } from "react";
import { ChevronDown, Plus, Timer, Trash2 } from "lucide-react";
import { BlockTimer, storedTimer } from "./block-timer";
import { db } from "./db";
import { type Block, type Data, blockFormats } from "./model";
import { Card, Field, Modal, Num, useAction, useNotice } from "./ui";
import {
  blockDefaults,
  blockDetails,
  blockTitle,
  deleteBlock,
  formatLabels,
  intervals,
  movementText,
  removeMovement,
  scoreText,
  updateBlock,
  updateMovement,
} from "./blocks";

const formatHints: Record<Block["format"], string> = {
  emom: "Jedes Intervall eine feste Arbeit, der Rest ist Pause.",
  amrap: "So viele Runden wie möglich in fester Zeit.",
  for_time: "Feste Runden so schnell wie möglich.",
};

const movementsOf = (b: Block, d: Data) =>
  d.sessionExercises
    .filter((x) => x.blockId === b.id)
    .sort((a, c) => a.order - c.order);

// Block parameters, shared by the create sheet and the block card.
function Params({
  value,
  onChange,
}: {
  value: Partial<Block> & Pick<Block, "format">;
  onChange: (patch: Partial<Block>) => void;
}) {
  const minutes = (label: string) => (
    <Field label={label}>
      <Num
        label={label}
        value={value.minutes}
        min={1}
        max={600}
        step={1}
        onChange={(n) => onChange({ minutes: n })}
      />
    </Field>
  );
  if (value.format === "emom")
    return (
      <div className="two-cols">
        {minutes("Dauer (Min.)")}
        <Field label="Intervall (Sek.)">
          <Num
            label="Intervall (Sek.)"
            value={value.intervalSeconds}
            min={10}
            max={3600}
            step={1}
            onChange={(n) => onChange({ intervalSeconds: n })}
          />
        </Field>
      </div>
    );
  if (value.format === "amrap") return minutes("Dauer (Min.)");
  return (
    <div className="two-cols">
      <Field label="Runden">
        <Num
          label="Runden"
          value={value.rounds}
          min={1}
          max={1000}
          step={1}
          onChange={(n) => onChange({ rounds: n })}
        />
      </Field>
      {minutes("Timecap (Min.)")}
    </div>
  );
}

export function NewBlockSheet({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (format: Block["format"], params: Partial<Block>) => void;
}) {
  const [value, setValue] = useState<Partial<Block> & Pick<Block, "format">>({
    format: "emom",
    ...blockDefaults.emom,
  });
  return (
    <Modal title="Block hinzufügen" onClose={onClose}>
      <div className="segmented" role="group" aria-label="Format">
        {blockFormats.map((f) => (
          <button
            key={f}
            className={value.format === f ? "selected" : ""}
            aria-pressed={value.format === f}
            onClick={() => setValue({ format: f, ...blockDefaults[f] })}
          >
            {formatLabels[f]}
          </button>
        ))}
      </div>
      <p className="muted">{formatHints[value.format]}</p>
      <Params
        value={value}
        onChange={(patch) => setValue((v) => ({ ...v, ...patch }))}
      />
      <button
        className="primary"
        onClick={() => {
          const { format, ...params } = value;
          onCreate(format, params);
        }}
      >
        Block anlegen
      </button>
    </Modal>
  );
}

export function BlockCard({
  block: b,
  index,
  open,
  data,
  onToggle,
  onAddMovement,
}: {
  block: Block;
  index: number;
  open: boolean;
  data: Data;
  onToggle: () => void;
  onAddMovement: () => void;
}) {
  const notify = useNotice(),
    { busy, run } = useAction(),
    [removing, setRemoving] = useState(false),
    [timing, setTiming] = useState(() => storedTimer()?.blockId === b.id),
    movements = movementsOf(b, data),
    n = intervals(b),
    save = (patch: Partial<Block>) =>
      void updateBlock(b.id, patch).catch(() =>
        notify("Block konnte nicht gespeichert werden."),
      ),
    minutesPart =
      b.scoreSeconds === undefined
        ? undefined
        : Math.floor(b.scoreSeconds / 60),
    secondsPart =
      b.scoreSeconds === undefined ? undefined : b.scoreSeconds % 60,
    setTime = (min: number | undefined, sec: number | undefined) =>
      save({
        scoreSeconds:
          min === undefined && sec === undefined
            ? undefined
            : (min ?? 0) * 60 + (sec ?? 0),
      }),
    roundsAndReps = (
      <div className="two-cols">
        <Field label="Runden">
          <Num
            label="Geschaffte Runden"
            value={b.scoreRounds}
            step={1}
            max={10000}
            onChange={(v) => save({ scoreRounds: v })}
          />
        </Field>
        <Field label="+ Wdh">
          <Num
            label="Zusätzliche Wiederholungen"
            value={b.scoreReps}
            step={1}
            max={100000}
            onChange={(v) => save({ scoreReps: v })}
          />
        </Field>
      </div>
    );
  return (
    <Card className={"training-card block-card " + (open ? "expanded" : "")}>
      <button className="exercise-heading" onClick={onToggle}>
        <span className="exercise-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <h2>{blockTitle(b)}</h2>
          <small>
            {blockDetails(b, movements.length)} · {scoreText(b)}
          </small>
        </div>
        <ChevronDown size={20} />
      </button>
      {open && (
        <>
          <Params value={b} onChange={save} />
          {b.format === "emom" && movements.length > 1 && (
            <label className="check">
              <input
                type="checkbox"
                checked={!!b.alternate}
                onChange={(e) => save({ alternate: e.target.checked })}
              />
              Übungen wechseln sich ab (pro Intervall eine)
            </label>
          )}
          <span className="eyebrow">
            {b.format === "emom" ? "Pro Intervall" : "Pro Runde"}
          </span>
          {movements.map((se) => {
            const e = data.exercises.find((x) => x.id === se.exerciseId)!,
              weight = ["weight_reps", "bodyweight_load"].includes(e.type),
              hold = e.type === "hold";
            return (
              <div
                key={se.id}
                className={"movement-row " + (weight ? "" : "no-weight")}
              >
                <span>
                  {e.name}
                  <small>{movementText(se, e.type)}</small>
                </span>
                {weight && (
                  <Num
                    label={`${e.name} kg pro Runde`}
                    value={se.targetWeight}
                    onChange={(v) =>
                      void updateMovement(se.id, { targetWeight: v }).catch(
                        () =>
                          notify("Gewicht konnte nicht gespeichert werden."),
                      )
                    }
                  />
                )}
                <Num
                  label={`${e.name} ${hold ? "Sekunden" : "Wiederholungen"} pro Runde`}
                  value={hold ? se.targetSeconds : se.targetReps}
                  step={hold ? "any" : 1}
                  max={hold ? 86400 : 10000}
                  onChange={(v) =>
                    void updateMovement(
                      se.id,
                      hold ? { targetSeconds: v } : { targetReps: v },
                    ).catch(() =>
                      notify("Wert konnte nicht gespeichert werden."),
                    )
                  }
                />
                <button
                  className="delete-set"
                  aria-label={`${e.name} aus dem Block entfernen`}
                  onClick={() => void run(() => removeMovement(se.id))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
          <button className="text-button" onClick={onAddMovement}>
            <Plus size={16} /> Übung in den Block
          </button>
          <button
            className="outline"
            disabled={!movements.length}
            onClick={() => setTiming(true)}
          >
            <Timer size={18} /> Timer starten
          </button>
          <span className="eyebrow">Resultat</span>
          {b.format === "emom" && (
            <div className="score-row">
              <Field label={`Geschaffte Intervalle (von ${n})`}>
                <Num
                  label="Geschaffte Intervalle"
                  value={b.scoreRounds}
                  step={1}
                  max={n}
                  onChange={(v) => save({ scoreRounds: v })}
                />
              </Field>
              <button
                className="outline"
                onClick={() => save({ scoreRounds: n })}
              >
                Alle geschafft
              </button>
            </div>
          )}
          {b.format === "amrap" && roundsAndReps}
          {b.format === "for_time" && (
            <>
              {b.capped ? (
                roundsAndReps
              ) : (
                <div className="two-cols">
                  <Field label="Zeit Min.">
                    <Num
                      label="Zeit Minuten"
                      value={minutesPart}
                      step={1}
                      max={1440}
                      onChange={(v) => setTime(v, secondsPart)}
                    />
                  </Field>
                  <Field label="Sek.">
                    <Num
                      label="Zeit Sekunden"
                      value={secondsPart}
                      step={1}
                      max={59}
                      onChange={(v) => setTime(minutesPart, v)}
                    />
                  </Field>
                </div>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={!!b.capped}
                  onChange={(e) => save({ capped: e.target.checked })}
                />
                Timecap erreicht, nicht fertig
              </label>
            </>
          )}
          <Field label="Notiz">
            <input
              aria-label={`Notiz ${blockTitle(b)}`}
              defaultValue={b.note ?? ""}
              placeholder="Wie lief es?"
              onChange={(ev) =>
                void db.blocks
                  .update(b.id, { note: ev.target.value })
                  .catch(() => notify("Notiz konnte nicht gespeichert werden."))
              }
            />
          </Field>
          <div className="actions wrap">
            <button className="text-button" onClick={() => setRemoving(true)}>
              <Trash2 size={15} /> Block entfernen
            </button>
          </div>
        </>
      )}
      {timing && (
        <BlockTimer block={b} data={data} onClose={() => setTiming(false)} />
      )}
      {removing && (
        <Modal title="Block entfernen?" onClose={() => setRemoving(false)}>
          <p>
            {blockTitle(b)} mit {movements.length}{" "}
            {movements.length === 1 ? "Übung" : "Übungen"} und dem Resultat wird
            aus dem Training entfernt.
          </p>
          <button
            className="primary danger"
            disabled={busy}
            onClick={() => void run(() => deleteBlock(b.id))}
          >
            <Trash2 size={18} /> Block entfernen
          </button>
          <button className="outline" onClick={() => setRemoving(false)}>
            Abbrechen
          </button>
        </Modal>
      )}
    </Card>
  );
}

// Read-only block in the history of a finished session.
export function BlockSummary({ block: b, data }: { block: Block; data: Data }) {
  const movements = movementsOf(b, data);
  return (
    <Card className="block-card">
      <div>
        <h2>{blockTitle(b)}</h2>
        <small className="muted">{blockDetails(b, movements.length)}</small>
      </div>
      {movements.map((se) => {
        const e = data.exercises.find((x) => x.id === se.exerciseId);
        return (
          <div className="row history-set" key={se.id}>
            <span>{e?.name}</span>
            <span>{e ? movementText(se, e.type) : ""}</span>
          </div>
        );
      })}
      <strong className="lime">{scoreText(b)}</strong>
      {b.note && <p>{b.note}</p>}
    </Card>
  );
}
