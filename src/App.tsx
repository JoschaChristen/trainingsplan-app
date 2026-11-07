import { useState, useEffect } from "react";
import {
  HashRouter,
  Routes,
  Route,
  NavLink,
  useLocation,
  Link,
} from "react-router-dom";
import {
  LayoutGrid,
  Dumbbell,
  CalendarDays,
  TrendingUp,
  Library,
  Check,
  X,
  Settings as Gear,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useData, seed } from "./db";
import { DataContext, NoticeContext } from "./ui";
import { Overview, History, SessionDetail } from "./overview";
import { ExerciseLibrary, ExerciseEditor } from "./exercises";
import { Training } from "./training-page";
import { Cycles, CycleEditor } from "./cycles-page";
import { BlockProgress, Progress, Skills } from "./progress-page";
import { SettingsPage } from "./settings-page";
import { AiPage, finishOAuth } from "./ai";
function Shell() {
  const data = useData(),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    location = useLocation();
  const {
    needRefresh: [update, setUpdate],
    offlineReady: [offline, setOffline],
    updateServiceWorker,
  } = useRegisterSW();
  useEffect(() => {
    seed()
      .then(() =>
        finishOAuth().catch((e) =>
          setNotice(
            e instanceof Error
              ? e.message
              : "OpenRouter-Anmeldung fehlgeschlagen.",
          ),
        ),
      )
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : "Die lokale Datenbank konnte nicht geöffnet werden.",
        ),
      );
    if (navigator.storage?.persist)
      void navigator.storage.persist().catch(() => {});
  }, []);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 7000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  useEffect(() => {
    // The offline-ready note is informational and covers the header, so it
    // hides itself; the update prompt stays until the user decides.
    if (offline && !update) {
      const t = setTimeout(() => setOffline(false), 6000);
      return () => clearTimeout(t);
    }
  }, [offline, update, setOffline]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  if (error)
    return (
      <main className="shell">
        <h1>Speichern nicht verfügbar</h1>
        <p>{error}</p>
        <p>
          Bitte öffne die App in einem Browser mit verfügbarem Gerätespeicher.
        </p>
      </main>
    );
  if (!data)
    return (
      <main className="shell">
        <h1>Trainingsplan</h1>
        <p>Daten werden geladen …</p>
      </main>
    );
  const live = location.pathname.startsWith("/session/");
  return (
    <DataContext.Provider value={data}>
      <NoticeContext.Provider value={setNotice}>
        <div className={"shell " + (live ? "live-shell" : "")}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/training" element={<History />} />
            <Route path="/session/:id" element={<Training />} />
            <Route path="/history/:id" element={<SessionDetail />} />
            <Route path="/cycles" element={<Cycles />} />
            <Route path="/cycles/:id" element={<CycleEditor />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/progress/blocks" element={<BlockProgress />} />
            <Route path="/skills" element={<Skills />} />
            <Route path="/exercises" element={<ExerciseLibrary />} />
            <Route path="/exercises/new" element={<ExerciseEditor />} />
            <Route path="/exercises/:id" element={<ExerciseEditor />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/ai" element={<AiPage />} />
            <Route
              path="*"
              element={
                <>
                  <h1>Seite nicht gefunden</h1>
                  <Link className="text-link" to="/">
                    Zur Übersicht
                  </Link>
                </>
              }
            />
          </Routes>
        </div>
        {!live && (
          <nav className="bottom-nav" aria-label="Hauptnavigation">
            {[
              ["/", "Übersicht", LayoutGrid],
              ["/training", "Training", Dumbbell],
              ["/cycles", "Zyklen", CalendarDays],
              ["/progress", "Fortschritt", TrendingUp],
              ["/exercises", "Übungen", Library],
            ].map(([path, label, Icon]) => {
              const I = Icon as typeof Gear;
              return (
                <NavLink
                  key={String(path)}
                  to={String(path)}
                  end={path === "/"}
                >
                  <I size={23} />
                  <span>{String(label)}</span>
                </NavLink>
              );
            })}
          </nav>
        )}
        {notice && (
          <div className="toast" role="status">
            {notice}
            <button
              aria-label="Meldung schliessen"
              onClick={() => setNotice("")}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {(update || offline) && (
          <div className="update-banner" role="status">
            <Check size={18} />
            <span>
              {update
                ? "Neue Version verfügbar."
                : "Bereit für dein Training, auch offline."}
            </span>
            {update && (
              <button onClick={() => void updateServiceWorker(true)}>
                Aktualisieren
              </button>
            )}
            <button
              aria-label="Hinweis schliessen"
              onClick={() => {
                setUpdate(false);
                setOffline(false);
              }}
            >
              <X size={18} />
            </button>
          </div>
        )}
      </NoticeContext.Provider>
    </DataContext.Provider>
  );
}
export function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
