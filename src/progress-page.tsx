import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, Sparkles, ChevronRight, Check, Trash2 } from "lucide-react";
import {
  Header,
  Card,
  Empty,
  Modal,
  Field,
  Submit,
  useApp,
  useAction,
  formValue,
} from "./ui";
import { db } from "./db";
import {
  uid,
  today,
  dateAdd,
  formatDate,
  fmt,
  rmSchema,
  stageSchema,
  type Exercise,
  type SkillStage,
} from "./model";
import { currentRm, series, plateau } from "./calculations";
const colors = ["#A8D5F7", "#C8F24A", "#BBA7F4", "#EDB47C"];
export function Progress() {
  const { data } = useApp(),
    [params] = useSearchParams(),
    tracked = data.exercises.filter((e) => e.trackOneRm && !e.archived),
    [chosen, setChosen] = useState<string[]>(
      params.get("exercise")
        ? [params.get("exercise")!]
        : tracked.slice(0, 3).map((e) => e.id),
    ),
    [range, setRange] = useState("3M"),
    [detail, setDetail] = useState<Exercise>(),
    [add, setAdd] = useState(false),
    { busy, run } = useAction();
  const selected = tracked.filter((e) => chosen.includes(e.id)),
    cutoff =
      range === "Alle"
        ? "0000-01-01"
        : dateAdd(today(), range === "3M" ? -90 : range === "6M" ? -180 : -365),
    points = selected.flatMap((e, i) =>
      series(e, data)
        .filter((p) => p.date >= cutoff)
        .map((p) => ({ ...p, color: colors[i % 4], exerciseId: e.id })),
    ),
    records = data.oneRms.filter(
      (r) => chosen.includes(r.exerciseId) && r.date >= cutoff,
    ),
    allDates = [...points, ...records].map((x) => Date.parse(x.date)),
    xmin = Math.min(...allDates),
    xmax = Math.max(...allDates),
    ymax =
      Math.max(
        10,
        ...points.map((p) => p.value),
        ...records.map((r) => r.value),
      ) * 1.1,
    x = (date: string) =>
      45 + ((Date.parse(date) - xmin) / (xmax - xmin || 1)) * 270,
    y = (v: number) => 175 - (v / ymax) * 145;
  return (
    <>
      <Header title="Fortschritt" sub="Deine Arbeit wird sichtbar">
        <button
          className="icon"
          onClick={() => setAdd(true)}
          aria-label="1RM eintragen"
        >
          <Plus />
        </button>
      </Header>
      <div className="segmented wide">
        <Link className="active" to="/progress">
          Lifts
        </Link>
        <Link to="/skills">Skills</Link>
      </div>
      <Link className="ai-link" to="/ai?kind=data_qa">
        <Sparkles size={20} />
        <span>
          Frag deine Daten …<small>Eine Frage zu deinem Fortschritt</small>
        </span>
        <ChevronRight size={20} />
      </Link>
      <div className="chips">
        {tracked.map((e) => (
          <button
            key={e.id}
            className={chosen.includes(e.id) ? "selected" : ""}
            onClick={() =>
              setChosen(
                chosen.includes(e.id)
                  ? chosen.filter((id) => id !== e.id)
                  : [...chosen, e.id].slice(-4),
              )
            }
          >
            {e.name}
          </button>
        ))}
      </div>
      <Card className="chart-card">
        <div className="row">
          <h2>Geschätztes 1RM</h2>
          <small>kg</small>
        </div>
        <div className="chips compact">
          {["3M", "6M", "1J", "Alle"].map((r) => (
            <button
              key={r}
              className={range === r ? "selected" : ""}
              onClick={() => setRange(r)}
            >
              {r}
            </button>
          ))}
        </div>
        {allDates.length ? (
          <svg
            viewBox="0 0 340 210"
            className="chart"
            role="img"
            aria-label="1RM-Verlauf. Die Werte sind auch in den Übungsdetails aufgeführt."
          >
            {[0, 1, 2, 3].map((i) => (
              <g key={i}>
                <line
                  x1="42"
                  x2="320"
                  y1={y((ymax * i) / 3)}
                  y2={y((ymax * i) / 3)}
                  stroke="#22405F"
                />
                <text x="2" y={y((ymax * i) / 3) + 4}>
                  {Math.round((ymax * i) / 3)}
                </text>
              </g>
            ))}
            {selected.map((e, i) => {
              const ps = points.filter((p) => p.exerciseId === e.id);
              return (
                <g key={e.id}>
                  <polyline
                    fill="none"
                    stroke={colors[i % 4]}
                    strokeWidth="2.5"
                    strokeDasharray={plateau(e, data) ? "6 4" : undefined}
                    points={ps
                      .map((p) => `${x(p.date)},${y(p.value)}`)
                      .join(" ")}
                  />
                  {ps.map((p, i) => (
                    <circle
                      key={i}
                      cx={x(p.date)}
                      cy={y(p.value)}
                      r="3"
                      fill={colors[selected.indexOf(e) % 4]}
                    />
                  ))}
                </g>
              );
            })}
            {records.map((r) => (
              <path
                key={r.id}
                d={`M${x(r.date)},${y(r.value) - 5}l5,5 -5,5 -5,-5z`}
                fill="none"
                stroke={
                  colors[selected.findIndex((e) => e.id === r.exerciseId) % 4]
                }
                strokeWidth="2"
              />
            ))}
            <text x="43" y="202">
              {new Date(xmin).toLocaleDateString("de-CH", {
                day: "2-digit",
                month: "2-digit",
              })}
            </text>
            <text x="280" y="202">
              {new Date(xmax).toLocaleDateString("de-CH", {
                day: "2-digit",
                month: "2-digit",
              })}
            </text>
          </svg>
        ) : (
          <div className="chart-empty">
            <span className="big-number">–</span>
            <p>
              Dein Verlauf beginnt mit einem gespeicherten Arbeitssatz oder
              einem eingetragenen 1RM.
            </p>
          </div>
        )}
        <small>Linie: geschätzt · Raute: getestet oder manuell</small>
      </Card>
      {tracked.map((e) => {
        const rm = currentRm(e, data),
          ps = series(e, data),
          delta = ps.length > 1 ? ps.at(-1)!.value - ps[0].value : 0;
        return (
          <button
            key={e.id}
            className="card lift-row"
            onClick={() => setDetail(e)}
          >
            <div>
              <strong>{e.name}</strong>
              <small>
                {rm
                  ? `${rm.source} · ${formatDate(rm.date)}`
                  : "Noch kein aktueller 1RM"}
              </small>
            </div>
            <div>
              <b>
                {rm ? fmt(rm.value) : "–"} <small>kg</small>
              </b>
              <small className={delta > 0 ? "lime" : ""}>
                {ps.length > 1
                  ? (delta > 0 ? "+" : "") + fmt(delta) + " kg seit Beginn"
                  : "Details →"}
              </small>
            </div>
          </button>
        );
      })}
      {tracked
        .filter((e) => plateau(e, data))
        .map((e) => (
          <Card className="ai-card" key={e.id}>
            <span className="eyebrow">Plateau erkannt</span>
            <h2>{e.name}</h2>
            <p>
              Der Bestwert der letzten sechs Wochen liegt nicht über dem der
              sechs Wochen davor.
            </p>
            <Link
              className="button outline"
              to={"/ai?kind=plateau&exercise=" + e.id}
            >
              <Sparkles size={16} /> KI-Analyse
            </Link>
          </Card>
        ))}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(undefined)}>
          <h3>Einheiten</h3>
          {series(detail, data).length ? (
            series(detail, data)
              .slice()
              .reverse()
              .map((p, i) => (
                <Link
                  className="row history-set"
                  key={i}
                  to={"/history/" + p.sessionId}
                >
                  {formatDate(p.date)}
                  <strong>{fmt(p.value)} kg</strong>
                </Link>
              ))
          ) : (
            <p>Keine geschätzten Maximalwerte vorhanden.</p>
          )}
          <h3>Beste Sätze je Wiederholungszahl</h3>
          {Array.from({ length: 10 }, (_, i) => i + 1).flatMap((reps) => {
            const sets = data.sets.filter(
              (s) =>
                s.exerciseId === detail.id &&
                s.done &&
                !s.isWarmup &&
                s.reps === reps &&
                s.weight !== undefined,
            );
            return sets.length
              ? [
                  <div className="row history-set" key={reps}>
                    <span>{reps} Wdh</span>
                    <strong>
                      {fmt(Math.max(...sets.map((s) => s.weight!)))} kg
                    </strong>
                  </div>,
                ]
              : [];
          })}
          <h3>Getestete und manuelle Maxima</h3>
          {data.oneRms
            .filter((r) => r.exerciseId === detail.id)
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((r) => (
              <div className="row history-set" key={r.id}>
                <span>{formatDate(r.date)}</span>
                <input
                  aria-label={"1RM vom " + formatDate(r.date)}
                  type="number"
                  min="0.5"
                  max="2000"
                  step="0.5"
                  defaultValue={r.value}
                  onBlur={(ev) => {
                    const n = ev.target.valueAsNumber;
                    if (n > 0 && n <= 2000)
                      void run(() => db.oneRms.update(r.id, { value: n }));
                  }}
                />
                <button
                  className="icon"
                  aria-label="1RM entfernen"
                  onClick={() => {
                    if (confirm("Diesen manuell eingetragenen 1RM entfernen?"))
                      void run(() => db.oneRms.delete(r.id));
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          <button
            className="primary"
            onClick={() => {
              setDetail(undefined);
              setAdd(true);
            }}
          >
            1RM eintragen
          </button>
        </Modal>
      )}
      {add && (
        <Modal title="1RM eintragen" onClose={() => setAdd(false)}>
          <form
            className="stack"
            onSubmit={(ev) => {
              const f = formValue(ev);
              void run(async () => {
                await db.oneRms.add(
                  rmSchema.parse({
                    id: uid(),
                    exerciseId: f.get("exercise"),
                    date: f.get("date"),
                    value: Number(f.get("value")),
                    source: f.get("source"),
                    note: f.get("note"),
                  }),
                );
                setChosen([String(f.get("exercise"))]);
                setAdd(false);
              });
            }}
          >
            <Field label="Übung">
              <select name="exercise">
                {tracked.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="two-cols">
              <Field label="Datum">
                <input
                  type="date"
                  name="date"
                  defaultValue={today()}
                  required
                />
              </Field>
              <Field label="1RM (kg)">
                <input
                  type="number"
                  name="value"
                  min="0.5"
                  max="2000"
                  step="0.5"
                  required
                />
              </Field>
            </div>
            <Field label="Quelle">
              <select name="source">
                <option value="tested">Getesteter Maximalversuch</option>
                <option value="manual">Bekannter 1RM, manuell</option>
              </select>
            </Field>
            <Field label="Notiz">
              <textarea name="note" />
            </Field>
            <Submit busy={busy} />
          </form>
        </Modal>
      )}
    </>
  );
}
export function Skills() {
  const { data } = useApp(),
    [selected, setSelected] = useState(""),
    [create, setCreate] = useState(false),
    [editStage, setEditStage] = useState<SkillStage>(),
    { busy, run } = useAction(),
    skill = data.skills.find((s) => s.id === selected) ?? data.skills[0],
    stages = data.stages
      .filter((s) => s.skillId === skill?.id)
      .sort((a, b) => a.order - b.order),
    stage = stages[skill?.currentStage ?? 0],
    logs = data.sets.filter(
      (s) => s.exerciseId === stage?.exerciseId && s.done && !s.isWarmup,
    ),
    value = (s: (typeof logs)[number]) =>
      stage?.criterion.kind === "hold_seconds"
        ? (s.seconds ?? 0)
        : (s.reps ?? 0),
    best = Math.max(0, ...logs.map(value)),
    target = stage?.criterion.target,
    met =
      stage?.criterion.kind !== "custom" &&
      target !== undefined &&
      best >= target;
  return (
    <>
      <Header title="Deine Skills" sub="Schritt für Schritt stärker">
        <button
          className="icon"
          aria-label="Neuer Skill"
          onClick={() => setCreate(true)}
        >
          <Plus />
        </button>
      </Header>
      <div className="segmented wide">
        <Link to="/progress">Lifts</Link>
        <Link className="active" to="/skills">
          Skills
        </Link>
      </div>
      <div className="chips">
        {data.skills.map((s) => (
          <button
            key={s.id}
            className={skill?.id === s.id ? "selected" : ""}
            onClick={() => setSelected(s.id)}
          >
            {s.name}
          </button>
        ))}
      </div>
      {!skill ? (
        <Empty title="Ein Ziel. Dein nächster Schritt.">
          <p>
            Handstand, L-Sit oder Muscle-up: Lege deinen Skill und die passenden
            Stufen an.
          </p>
          <button className="primary" onClick={() => setCreate(true)}>
            Skill anlegen
          </button>
        </Empty>
      ) : (
        <>
          <Card className="skill-hero">
            <span className="eyebrow">
              {skill.name} · Stufe{" "}
              {Math.min(skill.currentStage + 1, stages.length)} von{" "}
              {stages.length}
            </span>
            <h2>
              {stage?.name ??
                (stages.length
                  ? "Alle Stufen erreicht"
                  : "Lege deine erste Stufe an")}
            </h2>
            {stage && (
              <>
                <div className="big-number">
                  {best}
                  <span>
                    {" "}
                    / {target ?? "–"}{" "}
                    {stage.criterion.kind === "hold_seconds"
                      ? "s"
                      : stage.criterion.kind === "reps"
                        ? "Wdh"
                        : ""}
                  </span>
                </div>
                <progress max={target || 1} value={best} />
                <p>
                  {stage.criterion.text ??
                    "Bestwert deiner gespeicherten Sätze"}
                </p>
              </>
            )}
            {(met || stage?.criterion.kind === "custom") && (
              <button
                className="primary"
                onClick={() =>
                  void run(async () => {
                    if (!stage) return;
                    await db.transaction(
                      "rw",
                      db.skills,
                      db.stages,
                      async () => {
                        await db.stages.update(stage.id, {
                          achievedAt: new Date().toISOString(),
                        });
                        await db.skills.update(skill.id, {
                          currentStage: skill.currentStage + 1,
                        });
                      },
                    );
                  })
                }
              >
                {met
                  ? "Ziel erreicht. Nächste Stufe freigeben"
                  : "Stufe als erreicht bestätigen"}
              </button>
            )}
          </Card>
          {stage && (
            <Card>
              <h2>Dein Wochenverlauf</h2>
              <div className="bar-chart">
                {Array.from({ length: 10 }, (_, i) => {
                  const end = dateAdd(today(), -(9 - i) * 7),
                    start = dateAdd(end, -6),
                    v = Math.max(
                      0,
                      ...logs
                        .filter((s) => s.date >= start && s.date <= end)
                        .map(value),
                    ),
                    max = Math.max(best, target ?? 0, 1);
                  return (
                    <div key={i}>
                      <small>{v || ""}</small>
                      <span
                        style={{ height: Math.max(3, (v / max) * 90) + "px" }}
                      />
                      <small>
                        {start.slice(8)}.{start.slice(5, 7)}
                      </small>
                    </div>
                  );
                })}
              </div>
              <small>Bestwert je Siebentageszeitraum</small>
            </Card>
          )}
          <div className="section-title">
            <h2>Deine Stufen</h2>
            <Link to={"/ai?kind=skill_stages&skill=" + skill.id}>
              <Sparkles size={16} /> Vorschlagen
            </Link>
          </div>
          {stages.map((s, i) => (
            <button
              key={s.id}
              className={
                "card stage " + (i === skill.currentStage ? "current" : "")
              }
              onClick={() => setEditStage(s)}
            >
              <span className="stage-dot">
                {i < skill.currentStage ? <Check size={18} /> : i + 1}
              </span>
              <div>
                <strong>{s.name}</strong>
                <small>
                  {s.criterion.kind === "custom"
                    ? s.criterion.text
                    : `${s.criterion.target ?? "–"} ${s.criterion.kind === "hold_seconds" ? "Sekunden" : "Wiederholungen"}`}{" "}
                  ·{" "}
                  {data.exercises.find((e) => e.id === s.exerciseId)?.name ??
                    "Noch keine Übung verknüpft"}
                </small>
              </div>
              <ChevronRight size={18} />
            </button>
          ))}
          <button
            className="outline dashed"
            onClick={() =>
              setEditStage({
                id: uid(),
                skillId: skill.id,
                order: stages.length,
                name: "",
                criterion: { kind: "hold_seconds", target: 30 },
              })
            }
          >
            <Plus size={18} /> Stufe hinzufügen
          </button>
        </>
      )}
      {create && (
        <Modal title="Neuer Skill" onClose={() => setCreate(false)}>
          <form
            className="stack"
            onSubmit={(ev) => {
              const f = formValue(ev);
              void run(async () => {
                const id = uid();
                await db.skills.add({
                  id,
                  name: String(f.get("name")).trim(),
                  currentStage: 0,
                  createdAt: new Date().toISOString(),
                });
                setSelected(id);
                setCreate(false);
              });
            }}
          >
            <Field label="Name">
              <input
                name="name"
                placeholder="z. B. Handstand"
                required
                maxLength={150}
              />
            </Field>
            <Submit busy={busy} />
          </form>
        </Modal>
      )}
      {editStage && (
        <StageEditor
          stage={editStage}
          onClose={() => setEditStage(undefined)}
        />
      )}
    </>
  );
}
function StageEditor({
  stage,
  onClose,
}: {
  stage: SkillStage;
  onClose: () => void;
}) {
  const { data } = useApp(),
    [kind, setKind] = useState(stage.criterion.kind),
    { busy, run } = useAction();
  return (
    <Modal title="Stufe bearbeiten" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(ev) => {
          const f = formValue(ev);
          void run(async () => {
            await db.stages.put(
              stageSchema.parse({
                ...stage,
                name: String(f.get("name")).trim(),
                exerciseId: f.get("exercise") || undefined,
                criterion: {
                  kind,
                  target:
                    kind === "custom" ? undefined : Number(f.get("target")),
                  text: String(f.get("text")),
                },
              }),
            );
            onClose();
          });
        }}
      >
        <Field label="Name">
          <input name="name" defaultValue={stage.name} required />
        </Field>
        <Field label="Verknüpfte Übung">
          <select name="exercise" defaultValue={stage.exerciseId ?? ""}>
            <option value="">Noch keine</option>
            {data.exercises
              .filter((e) => !e.archived)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Kriterium">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="hold_seconds">Haltezeit</option>
            <option value="reps">Wiederholungen</option>
            <option value="custom">Eigene Beschreibung</option>
          </select>
        </Field>
        {kind !== "custom" && (
          <Field label="Zielwert">
            <input
              name="target"
              type="number"
              min="1"
              max="86400"
              defaultValue={stage.criterion.target ?? 30}
              required
            />
          </Field>
        )}
        <Field label="Beschreibung">
          <textarea name="text" defaultValue={stage.criterion.text} />
        </Field>
        <Submit busy={busy} />
      </form>
    </Modal>
  );
}
