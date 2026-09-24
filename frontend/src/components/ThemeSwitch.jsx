import { Moon, Sun } from "lucide-react";

// Pill switch: light (sun) on the left, dark (moon) on the right.
export default function ThemeSwitch({ theme, onChange }) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => onChange(dark ? "light" : "dark")}
      className="relative flex h-7 w-[3.25rem] shrink-0 items-center justify-between rounded-full border border-slate-800 bg-slate-950 px-1.5 text-slate-500"
    >
      <Sun size={13} />
      <Moon size={13} />
      <span
        className={`absolute top-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-slate-900 text-slate-100 shadow transition-all ${
          dark ? "left-[26px]" : "left-0.5"
        }`}
      >
        {dark ? <Moon size={13} /> : <Sun size={13} />}
      </span>
    </button>
  );
}
