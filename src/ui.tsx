import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
  type FormEvent,
} from "react";
import { X, ArrowLeft, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { ZodError } from "zod";
import { type Data, type Exercise, type Settings, defaults } from "./model";
export const DataContext = createContext<Data>(null!);
export const useApp = () => {
  const data = useContext(DataContext);
  return { data, settings: data.settings[0] ?? defaults };
};
export const NoticeContext = createContext<(text: string) => void>(() => {});
export const useNotice = () => useContext(NoticeContext);
// Validation and parser errors carry English developer text; show German.
export function errorText(e: unknown) {
  if (e instanceof ZodError)
    return "Ungültige Werte. Bitte Eingaben prüfen, es wurde nichts gespeichert.";
  if (e instanceof SyntaxError)
    return "Die Daten konnten nicht gelesen werden (ungültiges Format).";
  return e instanceof Error && e.message
    ? e.message
    : "Die Aktion konnte nicht gespeichert werden.";
}
export function useAction() {
  const notify = useNotice(),
    [busy, setBusy] = useState(false);
  return {
    busy,
    run: async (fn: () => Promise<unknown>) => {
      if (busy) return;
      setBusy(true);
      try {
        await fn();
      } catch (e) {
        notify(errorText(e));
      } finally {
        setBusy(false);
      }
    },
  };
}
export function Header({
  title,
  sub,
  back,
  children,
}: {
  title: string;
  sub?: string;
  back?: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {back && (
          <Link className="back" to={back}>
            <ArrowLeft size={19} /> Zurück
          </Link>
        )}
        {sub && <span className="eyebrow">{sub}</span>}
        <h1>{title}</h1>
      </div>
      <div className="actions">{children}</div>
    </header>
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={"card " + className}>{children}</section>;
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <Card className="empty">
      <span className="empty-mark">
        <Plus />
      </span>
      <h2>{title}</h2>
      {children}
    </Card>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prior;
    };
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} className="sheet">
      <div className="sheet-head">
        <h2>{title}</h2>
        <button className="icon" onClick={onClose} aria-label="Schliessen">
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Num({
  label,
  value,
  onChange,
  min = 0,
  max = 2000,
  step = "any",
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number | "any";
}) {
  const [raw, setRaw] = useState(value?.toString() ?? ""),
    focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setRaw(value?.toString() ?? "");
  }, [value]);
  return (
    <input
      type="number"
      inputMode={step === 1 ? "numeric" : "decimal"}
      min={min}
      max={max}
      step={step}
      aria-label={label}
      value={raw}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        setRaw(value?.toString() ?? "");
      }}
      onChange={(e) => {
        setRaw(e.target.value);
        const n = e.target.valueAsNumber;
        // An unparsable partial entry also reports "", but must not clear
        // the stored value; only a really empty field does.
        if (e.target.value === "") {
          if (!e.target.validity.badInput) onChange(undefined);
        } else if (
          Number.isFinite(n) &&
          n >= min &&
          n <= max &&
          (step !== 1 || Number.isInteger(n))
        )
          onChange(n);
      }}
    />
  );
}
export const typeLabels: Record<Exercise["type"], string> = {
  weight_reps: "Gewicht × Wdh",
  bodyweight_load: "Körpergewicht + Last",
  hold: "Haltezeit",
  reps_only: "Wiederholungen",
};
export function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (e: Exercise) => void;
  onClose: () => void;
}) {
  const { data } = useApp(),
    [query, setQuery] = useState("");
  return (
    <Modal title="Übung wählen" onClose={onClose}>
      <input
        autoFocus
        placeholder="Übungen suchen …"
        aria-label="Übungen suchen"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="pick-list">
        {data.exercises
          .filter(
            (e) =>
              !e.archived && e.name.toLowerCase().includes(query.toLowerCase()),
          )
          .sort((a, b) => a.name.localeCompare(b.name, "de-CH"))
          .map((e) => (
            <button key={e.id} onClick={() => onPick(e)}>
              <span>
                {e.name}
                <small>
                  {typeLabels[e.type]} · {e.category}
                </small>
              </span>
              <Plus size={20} />
            </button>
          ))}
      </div>
      <Link className="button outline" to="/exercises/new" onClick={onClose}>
        Neue Übung erstellen
      </Link>
    </Modal>
  );
}
export function Submit({
  busy,
  label = "Speichern",
}: {
  busy: boolean;
  label?: string;
}) {
  return (
    <button className="primary" disabled={busy} type="submit">
      {busy ? "Wird gespeichert …" : label}
    </button>
  );
}
export function formValue(e: FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return new FormData(e.currentTarget);
}
export function settingName(settings: Settings) {
  return settings.oneRmFormula === "epley" ? "Epley" : "Brzycki";
}
