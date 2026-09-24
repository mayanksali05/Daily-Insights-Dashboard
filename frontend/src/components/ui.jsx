import { AlertCircle, Loader2 } from "lucide-react";

export function SectionTitle({ icon: Icon, title, right }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-300">
        {Icon && <Icon size={16} className="text-indigo-400" />}
        {title}
      </h2>
      {right}
    </div>
  );
}

export function Loading({ label = "Loading…" }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
      <Loader2 size={16} className="animate-spin" /> {label}
    </div>
  );
}

export function ErrorNote({ message = "Couldn't load this section.", onRetry }) {
  return (
    <div className="flex items-center gap-2 py-4 text-sm text-rose-400">
      <AlertCircle size={16} /> {message}
      {onRetry && (
        <button onClick={() => onRetry()} className="ml-1 underline hover:text-rose-300">
          Retry
        </button>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-2">
      <span className="text-sm text-slate-200">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-indigo-600" : "bg-slate-700"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </label>
  );
}
