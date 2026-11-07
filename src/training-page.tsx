import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  Check,
  Trash2,
  Plus,
  Timer,
  ArrowLeft,
  ChevronDown,
  Repeat2,
} from "lucide-react";
import { db } from "./db";
import { type SetLog, fmt, formatDate } from "./model";
import {
  Header,
  Card,
  Empty,
  Modal,
  Field,
  Num,
  ExercisePicker,
  useApp,
  useNotice,
  useAction,
} from "./ui";
import {
  addExercise,
  appendSet,
  deleteSession,
  swapExercise,
} from "./training";
import { addBlock, addMovement } from "./blocks";
import { BlockCard, NewBlockSheet } from "./block-card";
import { personalRecords, volume, platesFor } from "./calculations";
export function Training() {
  const { id } = useParams(),
    { data, settings } = useApp(),
    session = data.sessions.find((s) => s.id === id),
    notify = useNotice(),
    { busy, run } = useAction(),
    nav = useNavigate();
  const [picker, setPicker] = useState(false),
    [swap, setSwap] = useState<string>(),
    [pickBlock, setPickBlock] = useState<string>(),
    [newBlock, setNewBlock] = useState(false),
    [expanded, setExpanded] = useState<string>(),
    [deleted, setDeleted] = useState<SetLog>(),
    [plateWeight, setPlateWeight] = useState<number>(),
    [finishing, setFinishing] = useState(false),
    [discarding, setDiscarding] = useState(false),
    [deadline, setDeadline] = useState(() =>
      Number(sessionStorage.getItem("training-rest") || 0),
    ),
    [now, setNow] = useState(Date.now()),
    [adjustTimer, setAdjustTimer] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (deadline && now >= deadline) {
      setDeadline(0);
      sessionStorage.removeItem("training-rest");
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [now, deadline]);
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  const entries = data.sessionExercises
      .filter((e) => e.sessionId === id)
      .sort((a, b) => a.order - b.order),
    standalone = entries.filter((e) => !e.blockId),
    blocks = data.blocks.filter((b) => b.sessionId === id),
    items = [
      ...standalone.map((se) => ({
        id: se.id,
        order: se.order,
        se,
        block: undefined,
      })),
      ...blocks.map((block) => ({
        id: block.id,
        order: block.order,
        se: undefined,
        block,
      })),
    ].sort((a, b) => a.order - b.order),
    allSets = data.sets.filter((s) =>
      entries.some((e) => e.id === s.sessionExerciseId),
    ),
    records = standalone.flatMap((se) => {
      const e = data.exercises.find((e) => e.id === se.exerciseId)!;
      return personalRecords(
        allSets.filter((s) => s.exerciseId === e.id),
        data.sets.filter(
          (s) => s.exerciseId === e.id && !allSets.some((x) => x.id === s.id),
        ),
        e,
        settings.oneRmFormula,
      );
    });
  if (!session) return <Empty title="Einheit nicht gefunden" />;
  if (session.finishedAt)
    return (
      <>
        <Header title="Training gespeichert" />
        <Link to={"/history/" + id}>Einheit ansehen</Link>
      </>
    );
  const rest = (duration: number) => {
    const end = Date.now() + duration * 1000;
    setDeadline(end);
    sessionStorage.setItem("training-rest", String(end));
  };
  return (
    <>
      <Header
        title={session.title ?? "Training"}
        sub={session.week ? `Woche ${session.week}` : undefined}
        leading={
          <Link
            className="icon back-icon"
            to="/training"
            aria-label="Zurück zur Trainingsübersicht"
          >
            <ArrowLeft />
          </Link>
        }
      >
        <button
          className={"timer " + (seconds ? "running" : "")}
          onClick={() => setAdjustTimer(true)}
          aria-label="Pausentimer"
        >
          <Timer size={18} />
          {seconds
            ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
            : "Pause"}
        </button>
      </Header>
      {!items.length && (
        <Empty title="Was steht heute an?">
          <p>
            Wähle die erste Übung oder einen Block für EMOM, AMRAP und For Time.
            Dein Training wird automatisch gespeichert.
          </p>
        </Empty>
      )}
      {items.map((item, index) => {
        const isOpen = (expanded ?? items[0]?.id) === item.id;
        if (item.block)
          return (
            <BlockCard
              key={item.id}
              block={item.block}
              index={index}
              open={isOpen}
              data={data}
              onToggle={() => setExpanded(isOpen ? "" : item.id)}
              onAddMovement={() => {
                setSwap(undefined);
                setPickBlock(item.id);
                setPicker(true);
              }}
            />
          );
        const se = item.se!,
          e = data.exercises.find((e) => e.id === se.exerciseId)!,
          sets = allSets
            .filter((s) => s.sessionExerciseId === se.id)
            .sort((a, b) => a.order - b.order),
          weight = ["weight_reps", "bodyweight_load"].includes(e.type),
          hold = e.type === "hold";
        const prevSe = data.sessionExercises
            .filter(
              (x) => x.exerciseId === e.id && x.sessionId !== id && !x.blockId,
            )
            .sort((a, b) =>
              (
                data.sessions.find((s) => s.id === b.sessionId)?.date ?? ""
              ).localeCompare(
                data.sessions.find((s) => s.id === a.sessionId)?.date ?? "",
              ),
            )[0],
          previous = data.sets
            .filter((s) => s.sessionExerciseId === prevSe?.id && !s.isWarmup)
            .sort((a, b) => a.order - b.order);
        return (
          <Card
            key={se.id}
            className={"training-card " + (isOpen ? "expanded" : "")}
          >
            <button
              className="exercise-heading"
              onClick={() => setExpanded(isOpen ? "" : se.id)}
            >
              <span className="exercise-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h2>{e.name}</h2>
                <small>
                  {se.status === "skipped"
                    ? "Ausgelassen"
                    : `${sets.filter((s) => s.done && !s.isWarmup).length}/${sets.filter((s) => !s.isWarmup).length} Arbeitssätze`}
                  {e.unilateral ? " · pro Seite" : ""}
                </small>
              </div>
              <ChevronDown size={20} />
            </button>
            {isOpen && (
              <>
                <div className={"set-table " + (!weight ? "no-weight" : "")}>
                  <div className="set-row table-head">
                    <span>Satz</span>
                    <span>Vorher</span>
                    {weight && (
                      <span>
                        {e.type === "bodyweight_load" ? "+ kg" : "kg"}
                      </span>
                    )}
                    <span>{hold ? "Sek." : "Wdh"}</span>
                    <span>✓</span>
                    <span />
                  </div>
                  {sets.map((s, i) => {
                    const p =
                      previous[
                        sets.slice(0, i + 1).filter((x) => !x.isWarmup).length -
                          1
                      ];
                    return (
                      <div
                        className={"set-row " + (s.done ? "done" : "")}
                        key={s.id}
                      >
                        <span className="set-number">
                          {s.isWarmup
                            ? "W"
                            : sets.slice(0, i + 1).filter((x) => !x.isWarmup)
                                .length}
                        </span>
                        <small>
                          {s.isWarmup
                            ? "–"
                            : p
                              ? hold
                                ? `${p.seconds ?? "–"} s`
                                : `${weight ? (p.weight ?? "–") + " × " : ""}${p.reps ?? "–"}`
                              : "–"}
                        </small>
                        {weight && (
                          <Num
                            label={`${e.name} Satz ${i + 1} kg`}
                            value={s.weight}
                            onChange={(n) =>
                              void db.sets
                                .update(s.id, { weight: n })
                                .catch(() =>
                                  notify(
                                    "Gewicht konnte nicht gespeichert werden.",
                                  ),
                                )
                            }
                          />
                        )}
                        <Num
                          label={`${e.name} Satz ${i + 1} ${hold ? "Sekunden" : "Wiederholungen"}`}
                          value={hold ? s.seconds : s.reps}
                          max={hold ? 86400 : 10000}
                          step={hold ? "any" : 1}
                          onChange={(n) =>
                            void db.sets
                              .update(s.id, hold ? { seconds: n } : { reps: n })
                              .catch(() =>
                                notify("Wert konnte nicht gespeichert werden."),
                              )
                          }
                        />
                        <button
                          className={"done-toggle " + (s.done ? "checked" : "")}
                          aria-label={`Satz ${i + 1} ${s.done ? "wieder öffnen" : "abhaken"}`}
                          aria-pressed={s.done}
                          onClick={() =>
                            void run(async () => {
                              if (
                                !s.done &&
                                ((hold ? !s.seconds : !s.reps) ||
                                  (weight && s.weight === undefined))
                              )
                                throw Error(
                                  "Bitte zuerst die Werte dieses Satzes eintragen.",
                                );
                              await db.sets.update(s.id, { done: !s.done });
                              if (!s.done) rest(settings.defaultRestSeconds);
                            })
                          }
                        >
                          <Check size={20} />
                        </button>
                        <button
                          className="delete-set"
                          aria-label={`Satz ${i + 1} entfernen`}
                          onClick={() =>
                            void run(async () => {
                              await db.sets.delete(s.id);
                              setDeleted(s);
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="row add-sets">
                  <button
                    className="text-button"
                    onClick={() => void run(() => appendSet(se.id))}
                  >
                    <Plus size={16} /> Satz
                  </button>
                  <button
                    className="text-button"
                    onClick={() => void run(() => appendSet(se.id, true))}
                  >
                    <Plus size={16} /> Aufwärmsatz
                  </button>
                </div>
                <div className="rpe">
                  <span className="eyebrow">RPE · letzter Arbeitssatz</span>
                  <div>
                    {[6, 7, 8, 9, 10].map((n) => (
                      <button
                        title={
                          [
                            "Leicht",
                            "Moderat",
                            "Anstrengend",
                            "Sehr schwer",
                            "Maximum",
                          ][n - 6]
                        }
                        key={n}
                        className={se.rpeLastSet === n ? "selected" : ""}
                        onClick={() =>
                          void run(() =>
                            db.sessionExercises.update(se.id, {
                              rpeLastSet: se.rpeLastSet === n ? undefined : n,
                            }),
                          )
                        }
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <small>6 leicht · 8 anstrengend · 10 Maximum</small>
                </div>
                <Field label="Notiz">
                  <input
                    aria-label={`Notiz ${e.name}`}
                    defaultValue={se.note ?? ""}
                    placeholder="Wie hat es sich angefühlt?"
                    onChange={(ev) => {
                      const note = ev.target.value;
                      void db.sessionExercises
                        .update(se.id, { note })
                        .catch(() =>
                          notify("Notiz konnte nicht gespeichert werden."),
                        );
                    }}
                  />
                </Field>
                <div className="actions wrap">
                  {weight && (
                    <button
                      className="text-button"
                      onClick={() =>
                        setPlateWeight(
                          sets.find((s) => !s.isWarmup)?.weight ??
                            settings.barWeight,
                        )
                      }
                    >
                      Scheibenrechner
                    </button>
                  )}
                  <button
                    className="text-button"
                    onClick={() => {
                      setSwap(se.id);
                      setPicker(true);
                    }}
                  >
                    <Repeat2 size={15} /> Tauschen
                  </button>
                  <button
                    className="text-button"
                    onClick={() =>
                      void run(async () => {
                        if (sets.some((s) => s.done))
                          throw Error(
                            "Öffne die bereits abgehakten Sätze, bevor du die Übung auslässt.",
                          );
                        await db.sessionExercises.update(se.id, {
                          status:
                            se.status === "skipped" ? "planned" : "skipped",
                        });
                      })
                    }
                  >
                    {se.status === "skipped" ? "Einplanen" : "Auslassen"}
                  </button>
                </div>
              </>
            )}
          </Card>
        );
      })}
      <button
        className="outline dashed"
        onClick={() => {
          setSwap(undefined);
          setPickBlock(undefined);
          setPicker(true);
        }}
      >
        <Plus size={19} /> Übung hinzufügen
      </button>
      <button
        className="outline dashed stacked"
        onClick={() => setNewBlock(true)}
      >
        <span>
          <Plus size={19} /> Block hinzufügen
        </span>
        <small>EMOM · AMRAP · For Time</small>
      </button>
      <button
        className="text-button discard"
        onClick={() => setDiscarding(true)}
      >
        <Trash2 size={16} /> Training verwerfen
      </button>
      <div className="finish-bar">
        <span>
          {allSets.filter((s) => s.done && !s.isWarmup).length} Sätze ·{" "}
          {fmt(volume(allSets))} kg
        </span>
        <button
          className="primary"
          disabled={!allSets.some((s) => s.done) || busy}
          onClick={() => setFinishing(true)}
        >
          Einheit abschliessen <Check size={20} />
        </button>
      </div>
      {deleted && (
        <div className="toast" role="status">
          Satz entfernt
          <button
            onClick={() =>
              void run(async () => {
                await db.sets.put(deleted);
                setDeleted(undefined);
              })
            }
          >
            Rückgängig
          </button>
          <button onClick={() => setDeleted(undefined)}>×</button>
        </div>
      )}
      {picker && (
        <ExercisePicker
          onClose={() => setPicker(false)}
          onPick={(e) =>
            void run(async () => {
              if (pickBlock) await addMovement(pickBlock, e.id, data);
              else if (swap) setExpanded(await swapExercise(swap, e.id, data));
              else setExpanded(await addExercise(session.id, e.id, data));
              setPicker(false);
            })
          }
        />
      )}
      {newBlock && (
        <NewBlockSheet
          onClose={() => setNewBlock(false)}
          onCreate={(format, params) =>
            void run(async () => {
              const blockId = await addBlock(session.id, format, params);
              setExpanded(blockId);
              setNewBlock(false);
              setSwap(undefined);
              setPickBlock(blockId);
              setPicker(true);
            })
          }
        />
      )}
      {adjustTimer && (
        <Modal title="Pausentimer" onClose={() => setAdjustTimer(false)}>
          <div className="chips">
            {[60, 90, 120, 180, 240].map((n) => (
              <button
                key={n}
                onClick={() => {
                  rest(n);
                  setAdjustTimer(false);
                }}
              >
                {n} s
              </button>
            ))}
          </div>
          <button
            className="outline"
            onClick={() => {
              setDeadline(0);
              sessionStorage.removeItem("training-rest");
              setAdjustTimer(false);
            }}
          >
            Pause beenden
          </button>
        </Modal>
      )}
      {plateWeight !== undefined && (
        <Modal
          title="Scheibenrechner"
          onClose={() => setPlateWeight(undefined)}
        >
          <Field label="Gesamtgewicht (kg)">
            <Num
              label="Gesamtgewicht"
              value={plateWeight}
              onChange={(n) => setPlateWeight(n ?? 0)}
            />
          </Field>
          <p>{settings.barWeight} kg Stange · je Seite</p>
          <div className="plates">
            {platesFor(
              plateWeight,
              settings.barWeight,
              settings.plates,
            ).plates.map((n, i) => (
              <span key={i}>{n}</span>
            ))}
          </div>
          <p>
            {platesFor(plateWeight, settings.barWeight, settings.plates)
              .remainder === 0
              ? "Exakt beladbar."
              : `${fmt(platesFor(plateWeight, settings.barWeight, settings.plates).remainder)} kg nicht beladbar.`}
          </p>
        </Modal>
      )}
      {discarding && (
        <Modal title="Training verwerfen?" onClose={() => setDiscarding(false)}>
          <p>
            Das Training vom {formatDate(session.date)} mit {entries.length}{" "}
            {entries.length === 1 ? "Übung" : "Übungen"} und {allSets.length}{" "}
            {allSets.length === 1 ? "Satz" : "Sätzen"} wird gelöscht. Das lässt
            sich nicht rückgängig machen.
          </p>
          <button
            className="primary danger"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await deleteSession(session.id);
                setDeadline(0);
                sessionStorage.removeItem("training-rest");
                nav("/training");
              })
            }
          >
            <Trash2 size={18} /> Training löschen
          </button>
          <button className="outline" onClick={() => setDiscarding(false)}>
            Abbrechen
          </button>
        </Modal>
      )}
      {finishing && (
        <Modal title="Stark gemacht." onClose={() => setFinishing(false)}>
          <div className="summary-stats">
            <div>
              <b>{allSets.filter((s) => s.done && !s.isWarmup).length}</b>
              <small>Arbeitssätze</small>
            </div>
            <div>
              <b>{fmt(volume(allSets))}</b>
              <small>kg Volumen</small>
            </div>
          </div>
          {allSets.some((s) => !s.done) && (
            <p className="muted">
              Nicht abgehakte Sätze bleiben als offen im Verlauf und zählen
              nicht zu deinen Bestwerten.
            </p>
          )}
          {records.length > 0 && (
            <>
              <h3>Neue Bestwerte</h3>
              {records.map((r, i) => (
                <p className="record" key={i}>
                  ↗ {r}
                </p>
              ))}
            </>
          )}
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await db.transaction(
                  "rw",
                  db.sessions,
                  db.sessionExercises,
                  async () => {
                    await db.sessions.update(session.id, {
                      finishedAt: new Date().toISOString(),
                    });
                    for (const se of entries)
                      if (
                        allSets.some(
                          (s) => s.sessionExerciseId === se.id && s.done,
                        )
                      )
                        await db.sessionExercises.update(se.id, {
                          status:
                            se.status === "substituted"
                              ? "substituted"
                              : "done",
                        });
                  },
                );
                setDeadline(0);
                sessionStorage.removeItem("training-rest");
                nav("/history/" + session.id);
              })
            }
          >
            Training speichern
          </button>
        </Modal>
      )}
    </>
  );
}
