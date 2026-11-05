import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Settings,
  Sparkles,
  Play,
  ArrowUpRight,
  ChevronRight,
  Dumbbell,
} from "lucide-react";
import { Header, Card, Empty, useApp, useAction } from "./ui";
import {
  today,
  dateAdd,
  formatDate,
  fmt,
  type Data,
  type Cycle,
} from "./model";
import { currentRm, series, volume, loadKg } from "./calculations";
import { startSession } from "./training";
export function cycleWeek(c: Cycle) {
  return Math.max(
    1,
    Math.min(
      c.weeks,
      Math.floor((Date.parse(today()) - Date.parse(c.startDate)) / 604800000) +
        1,
    ),
  );
}
export function nextDay(c: Cycle, d: Data) {
  const w = cycleWeek(c),
    days = d.days
      .filter((x) => x.cycleId === c.id)
      .sort((a, b) => a.order - b.order);
  return (
    days.find(
      (day) =>
        !d.sessions.some(
          (s) =>
            s.cycleId === c.id &&
            s.week === w &&
            s.dayId === day.id &&
            s.finishedAt,
        ),
    ) ?? days[0]
  );
}
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2)
    return <div className="spark-empty">Verlauf ab zwei Einheiten</div>;
  const min = Math.min(...values) * 0.97,
    max = Math.max(...values) * 1.03;
  return (
    <svg className="spark" viewBox="0 0 130 30" aria-label="1RM-Verlauf">
      <polyline
        points={values
          .map(
            (v, i) =>
              `${(i / (values.length - 1)) * 130},${28 - ((v - min) / (max - min || 1)) * 26}`,
          )
          .join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Overview() {
  const { data, settings } = useApp(),
    nav = useNavigate(),
    { busy, run } = useAction(),
    active = data.cycles.find((c) => c.status === "active"),
    day = active ? nextDay(active, data) : undefined,
    week = active ? cycleWeek(active) : 1,
    ongoing = data.sessions.find((s) => s.startedAt && !s.finishedAt);
  const tracked = data.exercises
    .filter((e) => e.trackOneRm)
    .sort(
      (a, b) =>
        data.sets.filter((s) => s.exerciseId === b.id).length -
        data.sets.filter((s) => s.exerciseId === a.id).length,
    )
    .slice(0, 4);
  const checkinWeek = active
    ? Array.from({ length: active.weeks }, (_, i) => i + 1)
        .filter((w) => {
          const days = data.days.filter((d) => d.cycleId === active.id);
          return (
            days.length > 0 &&
            days.every((day) =>
              data.sessions.some(
                (s) =>
                  s.cycleId === active.id &&
                  s.dayId === day.id &&
                  s.week === w &&
                  s.finishedAt,
              ),
            )
          );
        })
        .at(-1)
    : undefined;
  const due =
    !settings.lastBackupAt ||
    Date.now() - Date.parse(settings.lastBackupAt) > 14 * 86400000;
  return (
    <>
      <Header
        title="Hallo Joscha"
        sub={new Intl.DateTimeFormat("de-CH", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date())}
      >
        <Link className="icon" to="/ai" aria-label="KI-Assistent">
          <Sparkles />
        </Link>
        <Link className="icon" to="/settings" aria-label="Einstellungen">
          <Settings />
        </Link>
      </Header>
      {!data.sessions.length && (
        <Link className="onboarding" to="/settings">
          <span>
            Dein Trainingsverlauf zieht mit.
            <small>Alte Exportdatei importieren</small>
          </span>
          <ArrowUpRight size={22} />
        </Link>
      )}
      {active ? (
        <Link className="card cycle-card" to={"/cycles/" + active.id}>
          <div className="row">
            <div>
              <span className="eyebrow">Aktueller Zyklus</span>
              <strong>{active.name}</strong>
            </div>
            <span className="badge">
              Woche {week}/{active.weeks}
            </span>
          </div>
          <div className="week-bar">
            {Array.from({ length: active.weeks }, (_, i) => (
              <span
                key={i}
                className={
                  i + 1 === week ? "current" : i + 1 < week ? "past" : ""
                }
              />
            ))}
          </div>
          <small>
            {active.deloadWeeks.length
              ? `Deload: Woche ${active.deloadWeeks.join(", ")} · `
              : ""}
            Ende {formatDate(dateAdd(active.startDate, active.weeks * 7 - 1))}
          </small>
        </Link>
      ) : (
        <Card>
          <div className="row">
            <div>
              <span className="eyebrow">Dein nächster Block</span>
              <h2>Ein Plan, der mit dir wächst.</h2>
            </div>
            <Dumbbell className="baby" size={32} />
          </div>
          <Link to="/cycles" className="text-link">
            Zyklus planen <ArrowUpRight size={16} />
          </Link>
        </Card>
      )}
      <Card className="today-card">
        <div className="row">
          <span className="eyebrow">
            {ongoing
              ? "Einheit läuft"
              : day
                ? `Woche ${week} · ${day.label}`
                : "Bereit, wenn du es bist"}
          </span>
          <Play size={18} />
        </div>
        <h2>
          {ongoing?.title ??
            day?.title ??
            day?.label ??
            "Dein nächstes Training"}
        </h2>
        {day &&
          data.entries
            .filter((e) => e.dayId === day.id)
            .sort((a, b) => a.order - b.order)
            .map((en) => {
              const e = data.exercises.find((e) => e.id === en.exerciseId),
                c = data.cells.find(
                  (c) => c.entryId === en.id && c.week === week,
                );
              if (!e || !c) return null;
              const kg = loadKg(c, e, data);
              return (
                <div className="row compact" key={en.id}>
                  <strong>{e.name}</strong>
                  <span>
                    {c.sets} × {c.seconds ? `${c.seconds} s` : (c.reps ?? "–")}
                    {c.loadMode !== "none"
                      ? ` · ${kg === undefined ? "1RM fehlt" : fmt(kg) + " kg"}`
                      : ""}
                  </span>
                </div>
              );
            })}
        {!day && !ongoing && (
          <p>
            Wähle deine Übungen und halte fest, was heute zählt. Jeder Satz wird
            direkt gespeichert.
          </p>
        )}
        <button
          className="dark-button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const id =
                ongoing?.id ?? (await startSession(data, day?.id, week));
              nav("/session/" + id);
            })
          }
        >
          <Play size={19} />
          {ongoing ? "Training fortsetzen" : "Training starten"}
        </button>
      </Card>
      <div className="section-title">
        <h2>Deine Kraft</h2>
        <Link to="/progress">
          Alle Lifts <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="stat-grid">
        {tracked.map((e) => {
          const rm = currentRm(e, data),
            points = series(e, data);
          return (
            <Link
              to={"/progress?exercise=" + e.id}
              className="card stat"
              key={e.id}
            >
              <small>{e.name}</small>
              <div className="stat-value">
                {rm ? fmt(rm.value) : "–"} <span>kg</span>
              </div>
              <Sparkline values={points.slice(-8).map((p) => p.value)} />
              <small>
                {rm
                  ? `${rm.source} · ${formatDate(rm.date)}`
                  : points.length
                    ? "Kein aktueller 1RM · Verlauf erhalten"
                    : "Dein erster Satz ist der Anfang."}
              </small>
            </Link>
          );
        })}
      </div>
      {data.skills.slice(0, 1).map((skill) => {
        const stages = data.stages
            .filter((s) => s.skillId === skill.id)
            .sort((a, b) => a.order - b.order),
          stage = stages[skill.currentStage];
        return (
          <Link key={skill.id} className="card" to="/skills">
            <div className="row">
              <h2>{skill.name}</h2>
              <ChevronRight />
            </div>
            <p>
              Stufe {Math.min(skill.currentStage + 1, stages.length)} von{" "}
              {stages.length} ·{" "}
              {stage?.name ??
                (stages.length
                  ? "Alle Stufen erreicht"
                  : "Erste Stufe festlegen")}
            </p>
            <progress
              max={Math.max(1, stages.length)}
              value={skill.currentStage}
            />
          </Link>
        );
      })}
      {checkinWeek && active && (
        <Link
          className="ai-link"
          to={`/ai?kind=weekly_checkin&cycle=${active.id}&week=${checkinWeek}`}
        >
          <Sparkles size={20} />
          <span>
            Woche {checkinWeek} abgeschlossen
            <small>Wochen-Check-in anfordern</small>
          </span>
          <ChevronRight />
        </Link>
      )}
      {due && (
        <Link className="backup-hint" to="/settings">
          {settings.lastBackupAt
            ? "Zeit für ein Backup."
            : "Deine Daten bleiben auf diesem Gerät."}{" "}
          <span>Jetzt sichern →</span>
        </Link>
      )}
    </>
  );
}
export function History() {
  const { data } = useApp(),
    nav = useNavigate(),
    { busy, run } = useAction(),
    ongoing = data.sessions.find((s) => s.startedAt && !s.finishedAt);
  return (
    <>
      <Header title="Training" sub="Jeder Satz zählt" />
      <button
        className="primary"
        disabled={busy}
        onClick={() =>
          void run(async () =>
            nav("/session/" + (ongoing?.id ?? (await startSession(data)))),
          )
        }
      >
        <Play size={19} />
        {ongoing ? "Training fortsetzen" : "Freies Training starten"}
      </button>
      <div className="section-title">
        <h2>Deine Einheiten</h2>
        <span>
          {data.sessions.filter((s) => s.finishedAt).length} abgeschlossen
        </span>
      </div>
      {!data.sessions.length && (
        <Empty title="Hier beginnt dein Verlauf">
          <p>
            Starte ein Training oder importiere deine bisherigen Einträge in den
            Einstellungen.
          </p>
        </Empty>
      )}
      {[...data.sessions]
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date) ||
            (b.startedAt ?? "").localeCompare(a.startedAt ?? ""),
        )
        .map((s) => {
          const ids = data.sessionExercises
              .filter((e) => e.sessionId === s.id)
              .map((e) => e.id),
            sets = data.sets.filter((x) => ids.includes(x.sessionExerciseId));
          return (
            <Link
              key={s.id}
              className="card exercise-link"
              to={(s.finishedAt ? "/history/" : "/session/") + s.id}
            >
              <div>
                <small>
                  {formatDate(s.date)}
                  {s.dateIsApproximate ? " · Datum geschätzt" : ""}
                </small>
                <strong>{s.title ?? "Training"}</strong>
                <small>
                  {sets.filter((x) => x.done && !x.isWarmup).length} Sätze ·{" "}
                  {fmt(volume(sets))} kg Volumen {s.finishedAt ? "" : "· läuft"}
                </small>
              </div>
              <ChevronRight />
            </Link>
          );
        })}
    </>
  );
}
export function SessionDetail() {
  const { id } = useParams(),
    { data } = useApp(),
    s = data.sessions.find((s) => s.id === id);
  if (!s) return <Empty title="Einheit nicht gefunden" />;
  const entries = data.sessionExercises
    .filter((e) => e.sessionId === id)
    .sort((a, b) => a.order - b.order);
  return (
    <>
      <Header
        title={s.title ?? "Training"}
        sub={formatDate(s.date)}
        back="/training"
      />
      {s.dateIsApproximate && (
        <p className="muted">Das Datum wurde aus der alten App abgeleitet.</p>
      )}
      {entries.map((se) => (
        <Card key={se.id}>
          <h2>{data.exercises.find((e) => e.id === se.exerciseId)?.name}</h2>
          {se.status === "skipped" ? (
            <p>Ausgelassen</p>
          ) : (
            data.sets
              .filter((x) => x.sessionExerciseId === se.id)
              .sort((a, b) => a.order - b.order)
              .map((x, i) => (
                <div className="row history-set" key={x.id}>
                  <small>{x.isWarmup ? "W" : i + 1}</small>
                  <span>
                    {x.seconds !== undefined
                      ? `${fmt(x.seconds)} s`
                      : [
                          x.weight !== undefined ? `${fmt(x.weight)} kg` : null,
                          x.reps !== undefined ? `${x.reps} Wdh` : null,
                        ]
                          .filter(Boolean)
                          .join(" × ")}
                  </span>
                  <span className={x.done ? "lime" : "muted"}>
                    {x.done ? "✓" : "offen"}
                  </span>
                </div>
              ))
          )}
          {se.rpeLastSet && <small>RPE letzter Satz: {se.rpeLastSet}</small>}
          {se.note && <p>{se.note}</p>}
        </Card>
      ))}
      {s.note && (
        <Card>
          <p>{s.note}</p>
        </Card>
      )}
    </>
  );
}
