import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Plus,
  ChevronRight,
  Sparkles,
  Play,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { db } from "./db";
import {
  cycleSchema,
  cellSchema,
  uid,
  today,
  type Cycle,
  type CycleCell,
  type Exercise,
  fmt,
} from "./model";
import {
  Header,
  Card,
  Modal,
  Field,
  Submit,
  Empty,
  ExercisePicker,
  useApp,
  useAction,
  formValue,
} from "./ui";
import { currentRm, loadKg, progressed } from "./calculations";
import { cycleWeek } from "./overview";
import { startSession } from "./training";
export function Cycles() {
  const { data } = useApp(),
    [create, setCreate] = useState(false),
    nav = useNavigate(),
    { busy, run } = useAction();
  return (
    <>
      <Header title="Deine Zyklen">
        <button
          className="icon"
          aria-label="Zyklus erstellen"
          onClick={() => setCreate(true)}
        >
          <Plus />
        </button>
      </Header>
      <Link className="ai-link" to="/ai?kind=cycle_plan">
        <Sparkles size={20} />
        <span>
          Ein neuer Block mit KI
          <small>Vorschläge prüfen und selbst entscheiden</small>
        </span>
        <ChevronRight />
      </Link>
      {!data.cycles.length && (
        <Empty title="Dein Training bekommt Richtung">
          <p>Plane einen Block mit frei wählbaren Wochen und Trainingstagen.</p>
          <button className="primary" onClick={() => setCreate(true)}>
            Ersten Zyklus erstellen
          </button>
        </Empty>
      )}
      {[...data.cycles]
        .sort(
          (a, b) =>
            Number(b.status === "active") - Number(a.status === "active") ||
            b.createdAt.localeCompare(a.createdAt),
        )
        .map((c) => (
          <Link to={"/cycles/" + c.id} className="card" key={c.id}>
            <div className="row">
              <span
                className={"badge " + (c.status === "active" ? "" : "subtle")}
              >
                {
                  {
                    active: "Aktiv",
                    draft: "Entwurf",
                    completed: "Abgeschlossen",
                    archived: "Archiviert",
                  }[c.status]
                }
              </span>
              <ChevronRight size={20} />
            </div>
            <h2>{c.name}</h2>
            <small>
              {c.weeks} Wochen ·{" "}
              {data.days.filter((d) => d.cycleId === c.id).length} Trainingstage
              {c.status === "active" ? ` · Woche ${cycleWeek(c)}` : ""}
            </small>
          </Link>
        ))}
      {data.cycles.length > 0 && (
        <button className="outline dashed" onClick={() => setCreate(true)}>
          <Plus /> Zyklus erstellen
        </button>
      )}
      {create && (
        <Modal title="Neuer Zyklus" onClose={() => setCreate(false)}>
          <form
            className="stack"
            onSubmit={(ev) => {
              const f = formValue(ev);
              void run(async () => {
                const id = uid();
                await db.cycles.add(
                  cycleSchema.parse({
                    id,
                    name: String(f.get("name")).trim(),
                    startDate: f.get("start"),
                    weeks: Number(f.get("weeks")),
                    deloadWeeks:
                      f.get("deload") === "on" ? [Number(f.get("weeks"))] : [],
                    status: "draft",
                    createdBy: "user",
                    createdAt: new Date().toISOString(),
                    goal: f.get("goal"),
                  }),
                );
                nav("/cycles/" + id);
              });
            }}
          >
            <Field label="Name">
              <input
                name="name"
                placeholder="z. B. Kraftblock Herbst"
                required
                maxLength={150}
              />
            </Field>
            <div className="two-cols">
              <Field label="Startdatum">
                <input
                  name="start"
                  type="date"
                  defaultValue={today()}
                  required
                />
              </Field>
              <Field label="Wochen">
                <input
                  name="weeks"
                  type="number"
                  min="1"
                  max="52"
                  defaultValue="8"
                  required
                />
              </Field>
            </div>
            <Field label="Dein Ziel">
              <textarea name="goal" placeholder="Was möchtest du verbessern?" />
            </Field>
            <label className="check">
              <input name="deload" type="checkbox" defaultChecked /> Letzte
              Woche als Deload
            </label>
            <Submit busy={busy} label="Zyklus anlegen" />
          </form>
        </Modal>
      )}
    </>
  );
}
export function CycleEditor() {
  const { id } = useParams(),
    { data } = useApp(),
    c = data.cycles.find((c) => c.id === id),
    { busy, run } = useAction(),
    nav = useNavigate(),
    [dayId, setDayId] = useState(""),
    [picker, setPicker] = useState(false),
    [edit, setEdit] = useState(false),
    [addDay, setAddDay] = useState(false),
    [cell, setCell] = useState<CycleCell>(),
    [showKg, setShowKg] = useState(true),
    [template, setTemplate] = useState("linear");
  if (!c) return <Empty title="Zyklus nicht gefunden" />;
  const days = data.days
      .filter((d) => d.cycleId === c.id)
      .sort((a, b) => a.order - b.order),
    day = days.find((d) => d.id === dayId) ?? days[0],
    entries = data.entries
      .filter((e) => e.dayId === day?.id)
      .sort((a, b) => a.order - b.order),
    weeks = Array.from({ length: c.weeks }, (_, i) => i + 1);
  const add = (e: Exercise) =>
    run(async () => {
      if (!day) return;
      const entryId = uid(),
        rm = currentRm(e, data),
        hold = e.type === "hold",
        weighted = ["weight_reps", "bodyweight_load"].includes(e.type);
      await db.transaction("rw", db.entries, db.cells, async () => {
        await db.entries.add({
          id: entryId,
          cycleId: c.id,
          dayId: day.id,
          exerciseId: e.id,
          order: entries.length,
        });
        await db.cells.bulkAdd(
          weeks.map((w) => {
            const deload =
                c.deloadWeeks.includes(w) ||
                (template === "wave" && w % 4 === 0),
              pct = deload
                ? 60
                : template === "wave"
                  ? 70 + ((w - 1) % 4) * 5
                  : 70 + (w - 1) * 2.5;
            return {
              id: uid(),
              entryId,
              week: w,
              sets: deload ? 2 : 3,
              reps: hold ? undefined : 5,
              seconds: hold ? 30 : undefined,
              loadMode: weighted ? (rm ? "pct" : "kg") : "none",
              pct: weighted && rm ? pct : undefined,
              kg: weighted && !rm ? 0 : undefined,
            };
          }),
        );
      });
      setPicker(false);
    });
  return (
    <>
      <Header
        title={c.name}
        sub={`${c.weeks} Wochen · ${c.status === "active" ? "Aktiver Zyklus" : "Trainingsplan"}`}
        back="/cycles"
      >
        <button className="text-button" onClick={() => setEdit(true)}>
          Bearbeiten
        </button>
      </Header>
      {c.goal && <p className="muted">{c.goal}</p>}
      <div className="chips">
        {days.map((d) => (
          <button
            key={d.id}
            onClick={() => setDayId(d.id)}
            className={day?.id === d.id ? "selected" : ""}
          >
            {d.label}
          </button>
        ))}
        <button
          onClick={() => setAddDay(true)}
          aria-label="Trainingstag hinzufügen"
        >
          <Plus size={18} />
        </button>
      </div>
      {day && (
        <>
          <div className="section-title">
            <h2>{day.title || day.label}</h2>
            <div className="segmented">
              <button
                className={!showKg ? "active" : ""}
                onClick={() => setShowKg(false)}
              >
                %
              </button>
              <button
                className={showKg ? "active" : ""}
                onClick={() => setShowKg(true)}
              >
                kg
              </button>
            </div>
          </div>
          <div className="matrix-scroll">
            <table className="matrix">
              <thead>
                <tr>
                  <th>Übung</th>
                  {weeks.map((w) => (
                    <th
                      className={
                        w === cycleWeek(c) && c.status === "active"
                          ? "current"
                          : ""
                      }
                      key={w}
                    >
                      W{w}
                      {c.deloadWeeks.includes(w) && <small>Deload</small>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((en) => {
                  const e = data.exercises.find((e) => e.id === en.exerciseId)!;
                  return (
                    <tr key={en.id}>
                      <th>
                        {e.name}
                        <div className="actions">
                          <button
                            aria-label={e.name + " nach oben"}
                            onClick={() =>
                              void run(async () => {
                                const i = entries.indexOf(en);
                                if (i > 0)
                                  await db.transaction(
                                    "rw",
                                    db.entries,
                                    async () => {
                                      await db.entries.update(en.id, {
                                        order: entries[i - 1].order,
                                      });
                                      await db.entries.update(
                                        entries[i - 1].id,
                                        { order: en.order },
                                      );
                                    },
                                  );
                              })
                            }
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            aria-label={e.name + " nach unten"}
                            onClick={() =>
                              void run(async () => {
                                const i = entries.indexOf(en);
                                if (i < entries.length - 1)
                                  await db.transaction(
                                    "rw",
                                    db.entries,
                                    async () => {
                                      await db.entries.update(en.id, {
                                        order: entries[i + 1].order,
                                      });
                                      await db.entries.update(
                                        entries[i + 1].id,
                                        { order: en.order },
                                      );
                                    },
                                  );
                              })
                            }
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </th>
                      {weeks.map((w) => {
                        const existing = data.cells.find(
                            (x) => x.entryId === en.id && x.week === w,
                          ),
                          v = existing ?? {
                            id: uid(),
                            entryId: en.id,
                            week: w,
                            sets: 3,
                            reps: e.type === "hold" ? undefined : 5,
                            seconds: e.type === "hold" ? 30 : undefined,
                            loadMode: "none" as const,
                          };
                        return (
                          <td
                            key={w}
                            className={
                              c.deloadWeeks.includes(w) ? "deload" : ""
                            }
                          >
                            <button
                              aria-label={`${e.name} Woche ${w} bearbeiten`}
                              onClick={() => setCell(v)}
                            >
                              <strong>
                                {existing
                                  ? `${v.sets} × ${v.seconds ? `${v.seconds}s` : (v.reps ?? "–")}`
                                  : "+"}
                              </strong>
                              <small>
                                {existing
                                  ? v.loadMode === "pct" && !showKg
                                    ? `${v.pct}%`
                                    : v.loadMode === "none"
                                      ? e.type === "hold"
                                        ? "Halten"
                                        : "Körpergewicht"
                                      : `${loadKg(v, e, data) === undefined ? "1RM fehlt" : fmt(loadKg(v, e, data)!) + " kg"}`
                                  : "Planen"}
                              </small>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!entries.length && (
            <p className="muted">
              Füge die Übungen dieses Trainingstages hinzu. Du kannst jede Woche
              einzeln anpassen.
            </p>
          )}
          <Card>
            <Field label="Vorlage für neue Übungen">
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              >
                <option value="linear">Lineare Progression</option>
                <option value="wave">
                  Welle: 3 Wochen Aufbau, 1 Woche Entlastung
                </option>
              </select>
            </Field>
            <small>
              Ohne aktuellen 1RM beginnt die Planung bei 0 kg. Trage deine
              Arbeitsgewichte in der Matrix ein.
            </small>
            <button className="outline dashed" onClick={() => setPicker(true)}>
              <Plus size={18} /> Übung hinzufügen
            </button>
          </Card>
          <button
            className="primary"
            disabled={busy || !entries.length}
            onClick={() =>
              void run(async () => {
                nav(
                  "/session/" +
                    (await startSession(data, day.id, cycleWeek(c))),
                );
              })
            }
          >
            <Play size={18} /> {day.label} trainieren
          </button>
        </>
      )}
      {!days.length && (
        <Empty title="Deine Trainingstage">
          <p>
            Lege beispielsweise Tag A und Tag B an und ergänze deine Übungen.
          </p>
          <button className="primary" onClick={() => setAddDay(true)}>
            Trainingstag hinzufügen
          </button>
        </Empty>
      )}
      <div className="actions wrap">
        {c.status !== "active" && (
          <button
            className="outline"
            disabled={
              busy ||
              !days.length ||
              !data.entries.some((e) => e.cycleId === c.id)
            }
            onClick={() =>
              void run(async () => {
                await db.transaction("rw", db.cycles, async () => {
                  await db.cycles
                    .where("status")
                    .equals("active")
                    .modify({ status: "completed" });
                  await db.cycles.update(c.id, { status: "active" });
                });
              })
            }
          >
            Als aktiven Zyklus setzen
          </button>
        )}
        {c.status === "active" && (
          <button
            className="outline"
            onClick={() =>
              void run(() => db.cycles.update(c.id, { status: "completed" }))
            }
          >
            Zyklus abschliessen
          </button>
        )}
        <Link
          className="button outline"
          to={"/ai?kind=cycle_review&cycle=" + c.id}
        >
          <Sparkles size={16} /> Rückblick
        </Link>
      </div>
      {picker && (
        <ExercisePicker
          onClose={() => setPicker(false)}
          onPick={(e) => void add(e)}
        />
      )}
      {addDay && (
        <Modal title="Trainingstag" onClose={() => setAddDay(false)}>
          <form
            className="stack"
            onSubmit={(ev) => {
              const f = formValue(ev);
              void run(async () => {
                const id = uid();
                await db.days.add({
                  id,
                  cycleId: c.id,
                  label: String(f.get("label")).trim(),
                  title: String(f.get("title")),
                  order: days.length,
                });
                setDayId(id);
                setAddDay(false);
              });
            }}
          >
            <Field label="Bezeichnung">
              <input
                name="label"
                defaultValue={"Tag " + String.fromCharCode(65 + days.length)}
                required
                maxLength={60}
              />
            </Field>
            <Field label="Schwerpunkt">
              <input name="title" placeholder="z. B. Unterkörper + Handstand" />
            </Field>
            <Submit busy={busy} />
          </form>
        </Modal>
      )}
      {edit && (
        <Modal title="Zyklus bearbeiten" onClose={() => setEdit(false)}>
          <form
            className="stack"
            onSubmit={(ev) => {
              const f = formValue(ev);
              void run(async () => {
                const weeks = Number(f.get("weeks"));
                if (
                  data.cells.some(
                    (x) =>
                      data.entries.some(
                        (e) => e.id === x.entryId && e.cycleId === c.id,
                      ) && x.week > weeks,
                  )
                )
                  throw Error(
                    "Der Zyklus enthält bereits geplante spätere Wochen und kann nicht verkürzt werden.",
                  );
                const updated = cycleSchema.parse({
                  ...c,
                  name: f.get("name"),
                  startDate: f.get("start"),
                  weeks,
                  deloadWeeks: String(f.get("deload"))
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map(Number),
                  goal: f.get("goal"),
                });
                if (updated.deloadWeeks.some((w) => w > weeks))
                  throw Error("Deload-Woche liegt ausserhalb des Zyklus.");
                await db.transaction("rw", db.cycles, db.days, async () => {
                  await db.cycles.put(updated);
                  for (const d of days)
                    await db.days.update(d.id, {
                      label: String(f.get("day-" + d.id)).trim(),
                      title: String(f.get("title-" + d.id)),
                    });
                });
                setEdit(false);
              });
            }}
          >
            <Field label="Name">
              <input name="name" defaultValue={c.name} required />
            </Field>
            <div className="two-cols">
              <Field label="Startdatum">
                <input
                  type="date"
                  name="start"
                  defaultValue={c.startDate}
                  required
                />
              </Field>
              <Field label="Wochen">
                <input
                  type="number"
                  name="weeks"
                  min="1"
                  max="52"
                  defaultValue={c.weeks}
                  required
                />
              </Field>
            </div>
            <Field label="Deload-Wochen, mit Komma getrennt">
              <input name="deload" defaultValue={c.deloadWeeks.join(", ")} />
            </Field>
            <Field label="Ziel">
              <textarea name="goal" defaultValue={c.goal} />
            </Field>
            {days.map((d) => (
              <div className="two-cols" key={d.id}>
                <Field label="Tag">
                  <input name={"day-" + d.id} defaultValue={d.label} required />
                </Field>
                <Field label="Schwerpunkt">
                  <input name={"title-" + d.id} defaultValue={d.title} />
                </Field>
              </div>
            ))}
            <Submit busy={busy} />
          </form>
        </Modal>
      )}
      {cell && (
        <CellEditor cell={cell} cycle={c} onClose={() => setCell(undefined)} />
      )}
    </>
  );
}
function CellEditor({
  cell,
  cycle,
  onClose,
}: {
  cell: CycleCell;
  cycle: Cycle;
  onClose: () => void;
}) {
  const { data } = useApp(),
    entry = data.entries.find((e) => e.id === cell.entryId)!,
    exercise = data.exercises.find((e) => e.id === entry.exerciseId)!,
    [mode, setMode] = useState(cell.loadMode),
    { busy, run } = useAction();
  return (
    <Modal title={`${exercise.name} · Woche ${cell.week}`} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(ev) => {
          const f = formValue(ev);
          void run(async () => {
            const v = cellSchema.parse({
              ...cell,
              sets: Number(f.get("sets")),
              reps:
                exercise.type === "hold" ? undefined : Number(f.get("reps")),
              seconds:
                exercise.type === "hold" ? Number(f.get("seconds")) : undefined,
              loadMode: mode,
              pct: mode === "pct" ? Number(f.get("value")) : undefined,
              kg: mode === "kg" ? Number(f.get("value")) : undefined,
              note: String(f.get("note")),
            });
            const forward = f.get("forward") === "on",
              increment = Number(f.get("increment") || 0);
            const cells = Array.from(
              { length: forward ? cycle.weeks - cell.week + 1 : 1 },
              (_, i) =>
                cellSchema.parse({
                  ...v,
                  id:
                    i === 0
                      ? v.id
                      : (data.cells.find(
                          (c) =>
                            c.entryId === v.entryId && c.week === v.week + i,
                        )?.id ?? uid()),
                  week: v.week + i,
                  pct:
                    v.pct === undefined
                      ? undefined
                      : progressed(v.pct, increment, i),
                  kg:
                    v.kg === undefined
                      ? undefined
                      : progressed(v.kg, increment, i, exercise.weightStep),
                }),
            );
            await db.cells.bulkPut(cells);
            onClose();
          });
        }}
      >
        <div className="two-cols">
          <Field label="Sätze">
            <input
              name="sets"
              type="number"
              min="1"
              max="30"
              defaultValue={cell.sets}
              required
            />
          </Field>
          <Field
            label={exercise.type === "hold" ? "Sekunden" : "Wiederholungen"}
          >
            <input
              name={exercise.type === "hold" ? "seconds" : "reps"}
              type="number"
              min="1"
              max="1000"
              defaultValue={
                exercise.type === "hold"
                  ? (cell.seconds ?? 30)
                  : (cell.reps ?? 5)
              }
              required
            />
          </Field>
        </div>
        <Field label="Last">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="kg">Kilogramm</option>
            {exercise.trackOneRm && (
              <option value="pct">Prozent des aktuellen 1RM</option>
            )}
            <option value="none">Ohne Last</option>
          </select>
        </Field>
        {mode !== "none" && (
          <Field label={mode === "pct" ? "Prozent (%)" : "Gewicht (kg)"}>
            <input
              key={mode}
              name="value"
              type="number"
              min="0"
              max={mode === "pct" ? 200 : 2000}
              step="any"
              defaultValue={mode === "pct" ? (cell.pct ?? 70) : (cell.kg ?? 0)}
              required
            />
          </Field>
        )}
        <Field label="Notiz">
          <textarea name="note" defaultValue={cell.note} />
        </Field>
        <label className="check">
          <input type="checkbox" name="forward" /> Auf folgende Wochen
          übertragen
        </label>
        <Field label="Steigerung pro weiterer Woche (%)">
          <input
            name="increment"
            type="number"
            min="-20"
            max="20"
            step="0.5"
            defaultValue="0"
          />
        </Field>
        <Submit busy={busy} />
      </form>
    </Modal>
  );
}
