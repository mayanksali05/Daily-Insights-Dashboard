import { TrendingDown, TrendingUp } from "lucide-react";
import { api } from "../api";
import { useFetch } from "../hooks";
import { formatPrice } from "../utils";
import { ErrorNote, Loading } from "./ui";

function Sparkline({ points, up }) {
  if (!points || points.length < 2) return <div className="h-8" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points
    .map((p, i) => `${(i / (points.length - 1)) * 100},${30 - ((p - min) / span) * 28 - 1}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full">
      <polyline
        points={coords}
        fill="none"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        className={up ? "stroke-emerald-400" : "stroke-rose-400"}
      />
    </svg>
  );
}

function MarketCard({ m }) {
  if (m.error) {
    return (
      <div className="card">
        <p className="text-sm text-slate-400">{m.name}</p>
        <p className="mt-2 text-sm text-slate-500">Unavailable</p>
      </div>
    );
  }
  const up = m.change >= 0;
  const Arrow = up ? TrendingUp : TrendingDown;
  const tone = up ? "text-emerald-400" : "text-rose-400";
  return (
    <div className="card !p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-300">{m.name}</p>
        <Arrow size={16} className={tone} />
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-white">{formatPrice(m.price, m.prefix)}</p>
      <p className={`mt-0.5 text-sm font-medium tabular-nums ${tone}`}>
        {up ? "+" : ""}
        {m.change_percent.toFixed(2)}%
      </p>
      <div className="mt-2">
        <Sparkline points={m.sparkline} up={up} />
      </div>
    </div>
  );
}

export default function MarketCards({ keys }) {
  const { data, loading, error, reload } = useFetch(() => api.markets(keys), [keys.join(",")], 60 * 1000);
  if (!keys.length) return null;
  return (
    <section>
      {loading && <Loading label="Loading markets…" />}
      {error && <ErrorNote onRetry={reload} message="Market data unavailable." />}
      {data && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {data.map((m) => (
            <MarketCard key={m.key} m={m} />
          ))}
        </div>
      )}
    </section>
  );
}
