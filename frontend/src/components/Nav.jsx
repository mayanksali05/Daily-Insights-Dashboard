import { CheckSquare, LayoutDashboard, Settings, StickyNote, Activity } from "lucide-react";

export const VIEWS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "settings", label: "Settings", icon: Settings },
];

// Sidebar on desktop, bottom bar on mobile/tablet.
export default function Nav({ view, onChange }) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-slate-800 bg-slate-900 p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2 text-white">
          <Activity size={20} className="text-indigo-400" />
          <span className="font-semibold">Command Center</span>
        </div>
        <nav className="space-y-1">
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                view === key ? "bg-indigo-600/20 text-indigo-300" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              }`}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-slate-800 bg-slate-900 lg:hidden">
        {VIEWS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              view === key ? "text-indigo-300" : "text-slate-500"
            }`}
          >
            <Icon size={20} /> {label}
          </button>
        ))}
      </nav>
    </>
  );
}
