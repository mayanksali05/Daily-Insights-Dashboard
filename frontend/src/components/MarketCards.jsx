import { TrendingDown, TrendingUp } from "lucide-react";
import { api } from "../api";
import { useFetch } from "../hooks";
import { formatPrice } from "../utils";
import { ErrorNote, Loading } from "./ui";

// Each card is one cell of the first-row flex container in App.jsx.
const CELL = "min-w-0 basis-full sm:basis-[calc(50%-0.375rem)] xl:basis-0 xl:flex-1";

function Sparkline({ points, up }) {
  if (!points || points.length < 2) return <div className="h-10" />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points
    .map((p, i) => `${(i / (points.length - 1)) * 100},${30 - ((p - min) / span) * 28 - 1}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-10 w-full">
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
      <div className={`card !p-3 ${CELL}`}>
        <p className="text-sm text-slate-400">{m.name}</p>
        <p className="mt-2 text-sm text-slate-500">Unavailable</p>
      </div>
    );
  }
  const up = m.change >= 0;
  const Arrow = up ? TrendingUp : TrendingDown;
  const tone = up ? "text-emerald-400" : "text-rose-300";
  return (
    <div className={`card flex flex-col justify-between !p-3 ${CELL}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-300">
          {m.name} <span className="text-xs font-normal text-slate-500">{m.unit}</span>
        </p>
        <Arrow size={16} className={tone} />
      </div>
      <div className="mt-2 flex items-end justify-between gap-3 xl:mt-0">
        <div className="shrink-0">
          <p className="text-2xl font-semibold tabular-nums text-white">{formatPrice(m.price, m.prefix)}</p>
          <p className={`text-sm font-medium tabular-nums ${tone}`}>
            {up ? "+" : ""}
            {m.change_percent.toFixed(2)}%
          </p>
        </div>
        <div className="min-w-[5rem] flex-1 pl-2">
          <Sparkline points={m.sparkline} up={up} />
        </div>
      </div>
    </div>
  );
}

export default function MarketCards({ keys }) {
  const { data, loading, error, reload } = useFetch(() => api.markets(keys), [keys.join(",")], 60 * 1000);
  if (!keys.length) return null;
  return (
    <>
      {loading && (
        <div className={`card !p-3 ${CELL}`}>
          <Loading label="Loading prices…" />
        </div>
      )}
      {error && (
        <div className={`card !p-3 ${CELL}`}>
          <ErrorNote onRetry={reload} message="Prices unavailable." />
        </div>
      )}
      {data?.map((m) => (
        <MarketCard key={m.key} m={m} />
      ))}
    </>
  );
}
