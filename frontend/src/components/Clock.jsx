import { useNow } from "../hooks";

// Small quartz-style analog clock: the second hand ticks once per second (no sweep).
export default function Clock() {
  const now = useNow(1000);
  const s = now.getSeconds();
  const m = now.getMinutes();
  const h = now.getHours() % 12;

  const secAngle = s * 6;
  const minAngle = m * 6 + s * 0.1;
  const hourAngle = h * 30 + m * 0.5;

  const label = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div
      className="card flex w-full items-center justify-center !p-3 sm:w-auto xl:shrink-0"
      role="img"
      aria-label={`Current time ${label}`}
    >
      <svg viewBox="0 0 100 100" className="h-24 w-24">
        <circle cx="50" cy="50" r="47" className="fill-slate-950 stroke-slate-700" strokeWidth="2" />
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={i}
            x1="50"
            y1={i % 3 === 0 ? 8 : 10}
            x2="50"
            y2="14"
            transform={`rotate(${i * 30} 50 50)`}
            className={i % 3 === 0 ? "stroke-slate-200" : "stroke-slate-500"}
            strokeWidth={i % 3 === 0 ? 2.5 : 1.5}
            strokeLinecap="round"
          />
        ))}
        {/* hour */}
        <line x1="50" y1="54" x2="50" y2="28" transform={`rotate(${hourAngle} 50 50)`} className="stroke-slate-100" strokeWidth="3.5" strokeLinecap="round" />
        {/* minute */}
        <line x1="50" y1="56" x2="50" y2="17" transform={`rotate(${minAngle} 50 50)`} className="stroke-slate-300" strokeWidth="2.5" strokeLinecap="round" />
        {/* second */}
        <g transform={`rotate(${secAngle} 50 50)`}>
          <line x1="50" y1="60" x2="50" y2="12" className="stroke-indigo-400" strokeWidth="1.2" strokeLinecap="round" />
        </g>
        <circle cx="50" cy="50" r="2.5" className="fill-indigo-400" />
      </svg>
    </div>
  );
}
