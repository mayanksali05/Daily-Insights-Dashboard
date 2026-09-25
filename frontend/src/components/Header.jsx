import { CalendarDays, Settings } from "lucide-react";
import { useNow } from "../hooks";
import { greeting } from "../utils";
import Logo from "./Logo";
import ThemeSwitch from "./ThemeSwitch";

export default function Header({ name, onOpenSettings, theme, onThemeChange }) {
  const now = useNow(60000);
  return (
    <header className="flex w-full shrink-0 items-center justify-between gap-3">
      <h1 className="flex min-w-0 items-center gap-2.5 text-xl font-semibold text-white sm:text-2xl">
        <Logo size={30} />
        <span className="truncate">
          {greeting(now)}, {name || "there"}
        </span>
      </h1>
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <CalendarDays size={16} className="hidden sm:block" />
        <span className="hidden sm:inline">
          {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </span>
        <span className="ml-1">
          <ThemeSwitch theme={theme} onChange={onThemeChange} />
        </span>
        <button className="icon-btn" onClick={onOpenSettings} title="Settings" aria-label="Open settings">
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}
