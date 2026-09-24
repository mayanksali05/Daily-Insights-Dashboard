import { useState } from "react";
import BriefCard from "./components/BriefCard";
import Header from "./components/Header";
import MarketCards from "./components/MarketCards";
import Nav from "./components/Nav";
import NewsSections from "./components/NewsSection";
import NotesPage, { RecentNotes } from "./components/NotesPanel";
import SettingsPanel from "./components/SettingsPanel";
import TasksPanel from "./components/TasksPanel";
import WeatherCard from "./components/WeatherCard";
import { useSettings } from "./hooks";

export default function App() {
  const [settings, update] = useSettings();
  const [view, setView] = useState("dashboard");
  const [noteId, setNoteId] = useState(null);
  const s = settings.sections;

  const openNote = (id) => {
    setNoteId(id);
    setView("notes");
  };

  const topRow = [s.weather, s.brief].filter(Boolean).length;
  const bottomRow = [s.tasks, s.notes].filter(Boolean).length;

  return (
    <div className="min-h-screen">
      <Nav view={view} onChange={setView} />
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:ml-56 lg:pb-10">
        {view === "dashboard" && (
          <div className="space-y-5">
            <Header name={settings.name} />
            {s.markets && <MarketCards keys={settings.markets} />}

            {topRow > 0 && (
              <div className="grid gap-4 lg:grid-cols-3">
                {s.weather && (
                  <div className={topRow === 1 ? "lg:col-span-3" : ""}>
                    <WeatherCard city={settings.city} />
                  </div>
                )}
                {s.brief && (
                  <div className={topRow === 1 ? "lg:col-span-3" : "lg:col-span-2"}>
                    <BriefCard />
                  </div>
                )}
              </div>
            )}

            {s.news && <NewsSections categories={settings.news} />}

            {bottomRow > 0 && (
              <div className="grid gap-4 lg:grid-cols-5">
                {s.tasks && (
                  <div className={bottomRow === 1 ? "lg:col-span-5" : "lg:col-span-3"}>
                    <TasksPanel />
                  </div>
                )}
                {s.notes && (
                  <div className={bottomRow === 1 ? "lg:col-span-5" : "lg:col-span-2"}>
                    <RecentNotes onOpen={openNote} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {view === "tasks" && (
          <PageShell title="Tasks">
            <TasksPanel />
          </PageShell>
        )}
        {view === "notes" && (
          <PageShell title="Notes">
            <NotesPage key={noteId} initialId={noteId} />
          </PageShell>
        )}
        {view === "settings" && (
          <PageShell title="Settings">
            <SettingsPanel settings={settings} update={update} />
          </PageShell>
        )}
      </main>
    </div>
  );
}

function PageShell({ title, children }) {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      {children}
    </div>
  );
}
