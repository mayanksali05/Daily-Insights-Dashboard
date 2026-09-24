import { CalendarDays } from "lucide-react";
import { useNow } from "../hooks";
import { greeting } from "../utils";

export default function Header({ name }) {
  const now = useNow();
  return (
    <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          {greeting(now)}, {name || "there"}
        </h1>
        <p className="mt-1 text-sm text-slate-400">Here's your day at a glance.</p>
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <CalendarDays size={16} />
        <span>
          {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </span>
        <span className="rounded-md bg-slate-800 px-2 py-0.5 font-medium tabular-nums text-slate-100">
          {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </header>
  );
}
