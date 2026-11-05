import { useState } from "react";
import { Download, Upload, Sparkles, ExternalLink } from "lucide-react";
import { db } from "./db";
import {
  Header,
  Card,
  Field,
  Submit,
  Modal,
  useApp,
  useAction,
  formValue,
  typeLabels,
  useNotice,
} from "./ui";
import {
  settingsSchema,
  formatDate,
  dateAdd,
  exerciseTypes,
  type Data,
} from "./model";
import {
  backupSchema,
  legacySchema,
  type Legacy,
  type Mapping,
  convertLegacy,
  mappingsFor,
  datesFor,
  importData,
  importLegacyData,
  exportBackup,
  validateRelations,
} from "./import-export";
import { beginOAuth, testConnection } from "./ai";
export function SettingsPage() {
  const { settings } = useApp(),
    { busy, run } = useAction(),
    notify = useNotice(),
    [incoming, setIncoming] = useState<Data>(),
    [legacy, setLegacy] = useState<Legacy>(),
    [mappings, setMappings] = useState<Mapping[]>([]),
    [dates, setDates] = useState<Record<number, string>>({}),
    [replace, setReplace] = useState(false);
  const load = async (file: File) => {
    if (file.size > 20 * 1024 * 1024)
      throw Error("Die Datei ist grösser als 20 MB.");
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      throw Error("Diese Datei enthält kein gültiges JSON.");
    }
    const old = legacySchema.safeParse(raw);
    if (old.success) {
      setLegacy(old.data);
      setMappings(mappingsFor(old.data));
      setDates(datesFor(old.data));
      return;
    }
    const backup = backupSchema.safeParse(raw);
    if (!backup.success)
      throw Error(
        "Das Format oder die Daten der Datei werden nicht unterstützt. Bitte eine vollständige Trainingsplan-Exportdatei wählen.",
      );
    validateRelations(backup.data.data);
    setIncoming(backup.data.data);
    setReplace(false);
  };
  return (
    <>
      <Header title="Einstellungen" back="/" />
      <Card>
        <span className="eyebrow">Deine Daten gehören dir</span>
        <h2>Backup & Übernahme</h2>
        <p>
          Trainingsdaten werden auf diesem Gerät gespeichert. Sichere
          regelmässig eine Datei, damit dein Verlauf erhalten bleibt.
        </p>
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (await exportBackup())
                notify(
                  "Backup bereit. Bewahre die Datei ausserhalb der App auf.",
                );
            })
          }
        >
          <Download size={19} /> Backup exportieren
        </button>
        <label className="button outline import-button">
          <Upload size={19} /> Datei importieren
          <input
            type="file"
            accept=".json,application/json"
            aria-label="Backup oder alte Exportdatei importieren"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void run(() => load(file));
            }}
          />
        </label>
        <small>
          Alte App oder neues Backup · JSON
          {settings.lastBackupAt
            ? ` · Letztes Backup: ${formatDate(settings.lastBackupAt.slice(0, 10))}`
            : ""}
        </small>
      </Card>
      <form
        className="stack"
        onSubmit={(ev) => {
          const f = formValue(ev);
          void run(async () => {
            await db.settings.put(
              settingsSchema.parse({
                ...settings,
                oneRmFormula: f.get("formula"),
                barWeight: Number(f.get("bar")),
                defaultRestSeconds: Number(f.get("rest")),
                plates: String(f.get("plates"))
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map(Number),
                openRouterApiKey: String(f.get("key")).trim() || undefined,
                openRouterModel: String(f.get("model")).trim() || undefined,
                aiEnabled: f.get("ai") === "on",
              }),
            );
            notify("Einstellungen gespeichert.");
          });
        }}
      >
        <Card>
          <h2>Training</h2>
          <Field label="1RM-Formel">
            <select name="formula" defaultValue={settings.oneRmFormula}>
              <option value="epley">Epley</option>
              <option value="brzycki">Brzycki</option>
            </select>
          </Field>
          <div className="two-cols">
            <Field label="Stangengewicht (kg)">
              <input
                name="bar"
                type="number"
                min="0"
                max="100"
                step="any"
                defaultValue={settings.barWeight}
                required
              />
            </Field>
            <Field label="Pause (Sekunden)">
              <input
                name="rest"
                type="number"
                min="0"
                max="3600"
                defaultValue={settings.defaultRestSeconds}
                required
              />
            </Field>
          </div>
          <Field label="Scheiben pro Seite, mit Komma getrennt">
            <input
              name="plates"
              defaultValue={settings.plates.join(", ")}
              required
            />
          </Field>
        </Card>
        <Card className="ai-card">
          <div className="row">
            <h2>Dein KI-Assistent</h2>
            <Sparkles />
          </div>
          <p>
            Optional: Verbinde dein OpenRouter-Konto. Erst beim Anfordern eines
            Vorschlags werden die angezeigten Trainingszusammenfassungen
            übertragen. Kosten laufen über dein OpenRouter-Guthaben.
          </p>
          <button
            className="outline"
            type="button"
            onClick={() => void run(beginOAuth)}
          >
            <ExternalLink size={17} /> Mit OpenRouter verbinden
          </button>
          <Field label="Oder API-Schlüssel auf diesem Gerät">
            <input
              type="password"
              name="key"
              autoComplete="off"
              defaultValue={settings.openRouterApiKey ?? ""}
              placeholder="OpenRouter-Schlüssel"
            />
          </Field>
          <Field label="Modell-ID">
            <input
              name="model"
              defaultValue={settings.openRouterModel ?? ""}
              placeholder="Modell-ID aus deinem OpenRouter-Konto"
            />
          </Field>
          <label className="check">
            <input
              name="ai"
              type="checkbox"
              defaultChecked={settings.aiEnabled}
            />{" "}
            KI-Funktionen aktivieren
          </label>
          <small>Der Schlüssel wird nicht in Backups exportiert.</small>
          <button
            className="text-button"
            type="button"
            onClick={() =>
              void run(async () => {
                await testConnection(settings);
                notify("Verbindung zu OpenRouter erfolgreich.");
              })
            }
          >
            Gespeicherte Verbindung prüfen
          </button>
        </Card>
        <Submit busy={busy} label="Einstellungen speichern" />
      </form>
      {incoming && (
        <Modal
          title="Backup importieren"
          onClose={() => setIncoming(undefined)}
        >
          <ImportCounts data={incoming} />
          <p>
            Beim Zusammenführen werden bestehende Einträge mit derselben ID
            durch die Datei aktualisiert.
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />{" "}
            Alle vorhandenen Daten ersetzen
          </label>
          {replace && (
            <p className="warning">
              Vorhandene Trainingsdaten werden ersetzt. Sichere vorab ein
              Backup.
            </p>
          )}
          <button className="outline" onClick={() => void run(exportBackup)}>
            Vorhandene Daten zuerst sichern
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await importData(incoming, replace ? "replace" : "merge");
                setIncoming(undefined);
                notify("Backup erfolgreich importiert.");
              })
            }
          >
            {replace ? "Ersetzen bestätigen" : "Daten zusammenführen"}
          </button>
        </Modal>
      )}
      {legacy && (
        <Modal
          title="Alte Trainingsdaten übernehmen"
          onClose={() => setLegacy(undefined)}
        >
          <p>
            {legacy.setLogs.length} Einträge aus «{legacy.plan.name}». Gleicher
            neuer Name und gleiche Erfassungsart werden als eine Übung
            übernommen.
          </p>
          <details>
            <summary>Übungen zuordnen und Namen korrigieren</summary>
            <div className="mapping-list">
              {mappings.map((m, i) => (
                <div key={m.legacyId}>
                  <small>{m.legacyId}</small>
                  <Field label="Neuer Name">
                    <input
                      value={m.name}
                      onChange={(e) =>
                        setMappings(
                          mappings.map((v, j) =>
                            j === i ? { ...v, name: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </Field>
                  <select
                    aria-label={"Erfassungsart " + m.legacyId}
                    value={m.type}
                    onChange={(e) =>
                      setMappings(
                        mappings.map((v, j) =>
                          j === i
                            ? { ...v, type: e.target.value as Mapping["type"] }
                            : v,
                        ),
                      )
                    }
                  >
                    {exerciseTypes
                      .filter((t) => t !== "hold")
                      .map((t) => (
                        <option key={t} value={t}>
                          {typeLabels[t]}
                        </option>
                      ))}
                  </select>
                </div>
              ))}
            </div>
          </details>
          <h3>Trainingsdaten prüfen</h3>
          <p className="muted">
            Die alte App hat nur Änderungszeitpunkte gespeichert. Korrigiere die
            vorgeschlagenen Daten bei Bedarf.
          </p>
          <Field label="Alle Wochen ab diesem Datum wöchentlich setzen">
            <input
              type="date"
              onChange={(e) => {
                if (e.target.value)
                  setDates(
                    Object.fromEntries(
                      Object.keys(dates).map((w) => [
                        w,
                        dateAdd(e.target.value, (Number(w) - 1) * 7),
                      ]),
                    ),
                  );
              }}
            />
          </Field>
          {Object.entries(dates).map(([week, date]) => (
            <Field label={"Woche " + week} key={week}>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDates({ ...dates, [week]: e.target.value })}
              />
            </Field>
          ))}
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const converted = convertLegacy(legacy, mappings, dates);
                await importLegacyData(converted);
                setLegacy(undefined);
                notify(
                  `Importiert: ${converted.sessions.length} Einheiten und ${converted.sets.length} Sätze. Du kannst jetzt ein neues Backup sichern.`,
                );
              })
            }
          >
            Geprüfte Daten importieren
          </button>
        </Modal>
      )}
    </>
  );
}
function ImportCounts({ data }: { data: Data }) {
  return (
    <div className="summary-stats">
      <div>
        <b>{data.exercises.length}</b>
        <small>Übungen</small>
      </div>
      <div>
        <b>{data.sessions.length}</b>
        <small>Einheiten</small>
      </div>
      <div>
        <b>{data.sets.length}</b>
        <small>Sätze</small>
      </div>
    </div>
  );
}
