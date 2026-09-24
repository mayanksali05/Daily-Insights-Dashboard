import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, UNAUTHORIZED_EVENT } from "./api";
import BriefCard from "./components/BriefCard";
import Clock from "./components/Clock";
import Header from "./components/Header";
import Login from "./components/Login";
import MarketCards from "./components/MarketCards";
import NewsSections, { NewsSection } from "./components/NewsSection";
import NotesPage, { RecentNotes } from "./components/NotesPanel";
import NotionCard from "./components/NotionCard";
import SettingsPanel from "./components/SettingsPanel";
import TasksPanel from "./components/TasksPanel";
import WeatherCard from "./components/WeatherCard";
import { useSettings } from "./hooks";

export default function App() {
  const [settings, update] = useSettings();
  const [view, setView] = useState("dashboard"); // dashboard | notes | settings
  const [noteId, setNoteId] = useState(null);
  const s = settings.sections;

  // Apply the theme (index.html sets it before first paint to avoid a flash).
  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme]);
  const setTheme = (theme) => update({ theme });

  // Sign-in: "checking" until /api/auth/status answers; the deployed app requires a password.
  const [auth, setAuth] = useState({ state: "checking", required: false });
  useEffect(() => {
    api
      .authStatus()
      .then((r) => setAuth({ state: r.authenticated ? "in" : "out", required: r.auth_required }))
      .catch(() => setAuth({ state: "in", required: false })); // backend down: let cards show their errors
    const onExpired = () => setAuth((a) => ({ ...a, state: "out" }));
    window.addEventListener(UNAUTHORIZED_EVENT, onExpired);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onExpired);
  }, []);
  const logout = async () => {
    await api.logout().catch(() => {});
    setView("dashboard");
    setAuth((a) => ({ ...a, state: "out" }));
  };

  const openNote = (id) => {
    setNoteId(id);
    setView("notes");
  };

  const isDashboard = view === "dashboard";
  // AI news sits in row 2; the other news categories stay in row 3.
  const showAi = s.news && settings.news.includes("ai");
  const rowThreeNews = settings.news.filter((c) => c !== "ai");

  if (auth.state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }
  if (auth.state === "out") {
    return <Login onSuccess={() => setAuth((a) => ({ ...a, state: "in" }))} />;
  }

  return (
    <div className="min-h-screen">
      {/* On xl screens the dashboard fits the viewport (no page scroll); other pages scroll normally. */}
      <main
        className={
          isDashboard
            ? "px-4 py-3 sm:px-6 xl:h-screen xl:overflow-hidden"
            : "mx-auto max-w-5xl px-4 py-6 sm:px-6"
        }
      >
        {isDashboard && (
          <div className="flex flex-col gap-3 xl:h-full">
            <Header
              name={settings.name}
              onOpenSettings={() => setView("settings")}
              theme={settings.theme}
              onThemeChange={setTheme}
            />

            {/* Row 1: gold, silver, clock, weather */}
            <div className="flex flex-wrap gap-3 xl:h-32 xl:shrink-0 xl:flex-nowrap">
              {s.markets && <MarketCards keys={settings.markets} />}
              <Clock />
              {s.weather && <WeatherCard city={settings.city} />}
            </div>

            {/* Row 2: brief + AI news + notes + Notion */}
            {(s.brief || showAi || s.notes || s.notion) && (
              <div className="flex flex-col gap-3 xl:min-h-0 xl:flex-1 xl:flex-row">
                {s.brief && <BriefCard className="xl:flex-[1.5]" />}
                {showAi && <NewsSection category="ai" className="xl:flex-1" />}
                {s.notes && <RecentNotes className="xl:flex-1" onOpen={openNote} />}
                {s.notion && <NotionCard className="xl:flex-1" />}
              </div>
            )}

            {/* Row 3: world / india / tech news + tasks */}
            {((s.news && rowThreeNews.length > 0) || s.tasks) && (
              <div className="flex flex-col gap-3 xl:min-h-0 xl:flex-[1.5] xl:flex-row">
                {s.news && <NewsSections className="xl:flex-[2]" categories={rowThreeNews} />}
                {s.tasks && <TasksPanel className="xl:flex-1" />}
              </div>
            )}
          </div>
        )}

        {view === "notes" && (
          <PageShell title="Notes" onBack={() => setView("dashboard")}>
            <NotesPage key={noteId} initialId={noteId} />
          </PageShell>
        )}
        {view === "settings" && (
          <PageShell title="Settings" onBack={() => setView("dashboard")}>
            <SettingsPanel settings={settings} update={update} onLogout={auth.required ? logout : null} />
          </PageShell>
        )}
      </main>
    </div>
  );
}

function PageShell({ title, onBack, children }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button className="btn-ghost !px-2" onClick={onBack} aria-label="Back to dashboard">
          <ArrowLeft size={18} /> Dashboard
        </button>
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
      </div>
      {children}
    </div>
  );
}
