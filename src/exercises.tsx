import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, Search, Archive, ChevronRight } from "lucide-react";
import { db } from "./db";
import {
  categories,
  exerciseTypes,
  exerciseSchema,
  uid,
  type Exercise,
} from "./model";
import {
  useApp,
  Header,
  Card,
  Field,
  typeLabels,
  Submit,
  useAction,
  formValue,
  Empty,
} from "./ui";
export function ExerciseLibrary() {
  const { data } = useApp(),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("Alle"),
    [archive, setArchive] = useState(false);
  const filtered = data.exercises.filter(
    (e) =>
      e.archived === archive &&
      e.name.toLowerCase().includes(query.toLowerCase()) &&
      (category === "Alle" || e.category === category),
  );
  return (
    <>
      <Header title="Übungen">
        <Link className="icon" to="/exercises/new" aria-label="Neue Übung">
          <Plus />
        </Link>
      </Header>
      <div className="search">
        <Search size={20} />
        <input
          aria-label="Übungen suchen"
          placeholder="Übung suchen …"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="chips">
        {["Alle", ...categories].map((c) => (
          <button
            className={category === c ? "selected" : ""}
            onClick={() => setCategory(c)}
            key={c}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="section-title">
        <span>{filtered.length} Übungen</span>
        <button className="text-button" onClick={() => setArchive(!archive)}>
          <Archive size={16} /> {archive ? "Aktive Übungen" : "Archiv"}
        </button>
      </div>
      {filtered.map((e) => (
        <Link
          className="card exercise-link"
          to={"/exercises/" + e.id}
          key={e.id}
        >
          <div>
            <strong>{e.name}</strong>
            <small>
              {typeLabels[e.type]} · {e.category}
              {e.isCustom ? " · Eigene Übung" : ""}
            </small>
          </div>
          <ChevronRight size={20} />
        </Link>
      ))}
      {!filtered.length && (
        <Empty title="Keine Übungen gefunden">
          <p>Passe deine Suche an oder lege eine eigene Übung an.</p>
        </Empty>
      )}
    </>
  );
}
export function ExerciseEditor() {
  const { id } = useParams(),
    { data } = useApp(),
    existing = data.exercises.find((e) => e.id === id),
    [type, setType] = useState<Exercise["type"]>(
      existing?.type ?? "weight_reps",
    ),
    nav = useNavigate(),
    { busy, run } = useAction();
  if (id && !existing) return <Empty title="Übung nicht gefunden" />;
  return (
    <>
      <Header
        title={existing ? "Übung bearbeiten" : "Neue Übung"}
        back="/exercises"
      />
      <form
        className="stack"
        onSubmit={(ev) => {
          const f = formValue(ev);
          void run(async () => {
            const hasLogs =
              existing && data.sets.some((s) => s.exerciseId === existing.id);
            if (hasLogs && type !== existing.type)
              throw Error(
                "Die Erfassungsart einer Übung mit Trainingsdaten kann nicht geändert werden. Lege eine neue Übung an.",
              );
            const exercise = exerciseSchema.parse({
              id: existing?.id ?? uid(),
              name: String(f.get("name")).trim(),
              type,
              category: f.get("category"),
              trackOneRm:
                ["weight_reps", "bodyweight_load"].includes(type) &&
                f.get("rm") === "on",
              unilateral: f.get("unilateral") === "on",
              weightStep: Number(f.get("step")),
              isCustom: existing?.isCustom ?? true,
              archived: existing?.archived ?? false,
              createdAt: existing?.createdAt ?? new Date().toISOString(),
              aliases: existing?.aliases,
            });
            await db.exercises.put(exercise);
            nav("/exercises");
          });
        }}
      >
        <Card>
          <Field label="Name der Übung">
            <input
              name="name"
              required
              maxLength={150}
              defaultValue={existing?.name}
              placeholder="z. B. Bulgarian Split Squat"
            />
          </Field>
        </Card>
        <Card>
          <h2>Wie wird erfasst?</h2>
          <div className="type-grid">
            {exerciseTypes.map((t) => (
              <button
                key={t}
                type="button"
                className={type === t ? "type selected" : "type"}
                onClick={() => setType(t)}
              >
                {typeLabels[t]}
                <small>
                  {t === "hold"
                    ? "Sekunden"
                    : t === "reps_only"
                      ? "Ohne Gewicht"
                      : t === "bodyweight_load"
                        ? "+ kg und Wiederholungen"
                        : "kg und Wiederholungen"}
                </small>
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <Field label="Kategorie">
            <select
              name="category"
              defaultValue={existing?.category ?? "Andere"}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <label className="check">
            <input
              type="checkbox"
              name="rm"
              defaultChecked={existing?.trackOneRm ?? true}
              disabled={!["weight_reps", "bodyweight_load"].includes(type)}
            />{" "}
            1RM berechnen
          </label>
          <label className="check">
            <input
              type="checkbox"
              name="unilateral"
              defaultChecked={existing?.unilateral}
            />{" "}
            Einseitig, Werte pro Seite
          </label>
          <Field label="Gewichtsschritt">
            <select name="step" defaultValue={existing?.weightStep ?? 2.5}>
              {[1, 1.25, 2.5].map((n) => (
                <option key={n} value={n}>
                  {n} kg
                </option>
              ))}
            </select>
          </Field>
        </Card>
        <Card className="preview-card">
          <span className="eyebrow">Vorschau · Beispieldaten</span>
          <div className="row">
            <strong>Satz 1</strong>
            <span>
              {type === "hold"
                ? "30 s"
                : type === "reps_only"
                  ? "8 Wdh"
                  : type === "bodyweight_load"
                    ? "+ 5 kg × 5"
                    : "60 kg × 5"}
            </span>
            <span className="lime">✓</span>
          </div>
        </Card>
        <Submit busy={busy} />
        {existing && (
          <button
            type="button"
            className="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await db.exercises.update(existing.id, {
                  archived: !existing.archived,
                });
                nav("/exercises");
              })
            }
          >
            {existing.archived ? "Wieder aktivieren" : "Übung archivieren"}
          </button>
        )}
      </form>
    </>
  );
}
