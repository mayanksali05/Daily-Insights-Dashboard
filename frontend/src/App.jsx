import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { api, UNAUTHORIZED_EVENT } from "./api";
import BriefCard from "./components/BriefCard";
import Header from "./components/Header";
import Login from "./components/Login";
import MarketCards from "./components/MarketCards";
import NewsSections, { NewsSection } from "./components/NewsSection";
import NotesPage, { RecentNotes } from "./components/NotesPanel";
import NotionCard from "./components/NotionCard";
import NowPlayingCard from "./components/NowPlayingCard";
import SettingsPanel from "./components/SettingsPanel";
import TasksPanel from "./components/TasksPanel";
import WeatherCard from "./components/WeatherCard";
import { useSettings } from "./hooks";

// Signs the user in, then renders their dashboard.
export default function App() {
  const [auth, setAuth] = useState({ state: "checking", user: null, signup: "closed" });

  const refresh = () =>
    api
      .authStatus()
      .then((r) => setAuth({ state: r.authenticated ? "in" : "out", user: r.user, signup: r.signup }))
      .catch(() => setAuth({ state: "offline", user: null, signup: "closed" }));

  useEffect(() => {
    refresh();
    const onExpired = () => setAuth((a) => ({ ...a, state: "out", user: null }));
    window.addEventListener(UNAUTHORIZED_EVENT, onExpired);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onExpired);
  }, []);

  if (auth.state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }
  if (auth.state === "offline") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center text-sm text-slate-400">
        <p>Can't reach the dashboard server. On the free plan it can take about a minute to wake up.</p>
        <button className="btn-primary" onClick={() => { setAuth((a) => ({ ...a, state: "checking" })); refresh(); }}>
          Try again
        </button>
      </div>
    );
  }
  if (auth.state === "out") {
    return (
      <Login
        signupMode={auth.signup}
        onSuccess={(user) => setAuth({ state: "in", user, signup: auth.signup })}
      />
    );
  }

  const logout = async () => {
    await api.logout().catch(() => {});
    await refresh();
  };
  // key: a different account gets a fresh dashboard (its own settings)
  return <Dashboard key={auth.user.id} user={auth.user} onLogout={logout} onUserChanged={refresh} />;
}

function Dashboard({ user, onLogout, onUserChanged }) {
  const [settings, update] = useSettings(user.settings, (s) => api.saveSettings(s).catch(() => {}));
  const [view, setView] = useState("dashboard"); // dashboard | notes | settings
  const [noteId, setNoteId] = useState(null);
  const s = settings.sections;

  // Apply the theme (index.html sets it from the local cache before first paint).
  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings.theme]);
  const setTheme = (theme) => update({ theme });

  const openNote = (id) => {
    setNoteId(id);
    setView("notes");
  };
  const openSettings = () => setView("settings");

  const isDashboard = view === "dashboard";
  // AI news sits in row 2; the other news categories stay in row 3.
  const showAi = s.news && settings.news.includes("ai");
  const rowThreeNews = settings.news.filter((c) => c !== "ai");

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
          // Below xl the row wrappers become `contents`, so every tile sits in one wrapping list and
          // `max-xl:order-*` puts the everyday things first on phones and tablets:
          // gold, silver → tasks, expenses → weather → notes, brief → AI news → news → now playing.
          // On xl screens (desktop / widget) the three rows below apply unchanged.
          <div className="flex flex-wrap gap-3 xl:h-full xl:flex-col xl:flex-nowrap">
            <Header
              name={settings.name || user.name}
              onOpenSettings={openSettings}
              theme={settings.theme}
              onThemeChange={setTheme}
            />

            {/* Row 1: gold, silver, now playing, weather */}
            <div className="flex flex-wrap gap-3 max-xl:contents xl:h-32 xl:shrink-0 xl:flex-nowrap">
              {s.markets && <MarketCards keys={settings.markets} />}
              <NowPlayingCard className="max-xl:order-9" />
              {s.weather && <WeatherCard className="max-xl:order-4" city={settings.city} />}
            </div>

            {/* Row 2: brief + AI news + notes + Notion */}
            {(s.brief || showAi || s.notes || s.notion) && (
              <div className="flex flex-col gap-3 max-xl:contents xl:min-h-0 xl:flex-1 xl:flex-row">
                {s.brief && <BriefCard className="basis-full max-xl:order-6 md:max-xl:basis-[calc(50%-0.375rem)] md:max-xl:grow xl:flex-[1.5]" />}
                {showAi && <NewsSection category="ai" className="basis-full max-xl:order-7 xl:flex-1" />}
                {s.notes && <RecentNotes className="basis-full max-xl:order-5 md:max-xl:basis-[calc(50%-0.375rem)] md:max-xl:grow xl:flex-1" onOpen={openNote} />}
                {s.notion && (
                  <NotionCard className="basis-full max-xl:order-3 md:max-xl:basis-[calc(50%-0.375rem)] md:max-xl:grow xl:flex-1" onOpenSettings={openSettings} />
                )}
              </div>
            )}

            {/* Row 3: world / india / tech news + tasks */}
            {((s.news && rowThreeNews.length > 0) || s.tasks) && (
              <div className="flex flex-col gap-3 max-xl:contents xl:min-h-0 xl:flex-[1.5] xl:flex-row">
                {s.news && <NewsSections className="basis-full max-xl:order-8 xl:flex-[2]" categories={rowThreeNews} />}
                {s.tasks && <TasksPanel className="basis-full max-xl:order-2 md:max-xl:basis-[calc(50%-0.375rem)] md:max-xl:grow xl:flex-1" />}
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
            <SettingsPanel
              settings={settings}
              update={update}
              user={user}
              onLogout={onLogout}
              onUserChanged={onUserChanged}
            />
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
