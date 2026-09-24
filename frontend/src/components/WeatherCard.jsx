import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, Sun, Wind } from "lucide-react";
import { api } from "../api";
import { useFetch } from "../hooks";
import { ErrorNote, Loading, SectionTitle } from "./ui";

const ICONS = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

function WIcon({ name, size = 20, className = "" }) {
  const Icon = ICONS[name] || Cloud;
  return <Icon size={size} className={className} />;
}

export default function WeatherCard({ city }) {
  const { data, loading, error, reload } = useFetch(() => api.weather(city), [city], 15 * 60 * 1000);

  return (
    <section className="card h-full">
      <SectionTitle icon={Sun} title="Weather" />
      {loading && <Loading />}
      {error && <ErrorNote onRetry={reload} message="Weather unavailable." />}
      {data && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">
                {data.city}
                {data.country ? `, ${data.country}` : ""}
              </p>
              <p className="mt-1 text-5xl font-semibold text-white">{data.temperature}°</p>
              <p className="mt-1 text-sm text-slate-300">
                {data.label} · feels like {data.feels_like}°
              </p>
            </div>
            <WIcon name={data.icon} size={56} className="text-amber-300" />
          </div>
          <div className="mt-3 flex gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1"><Droplets size={14} /> {data.humidity}%</span>
            <span className="flex items-center gap-1"><Wind size={14} /> {data.wind_kmh} km/h</span>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2 border-t border-slate-800 pt-4">
            {data.forecast.map((d, i) => (
              <div key={d.date} className="flex flex-col items-center gap-1 text-center">
                <span className="text-xs text-slate-500">
                  {i === 0 ? "Today" : new Date(d.date + "T00:00").toLocaleDateString("en-IN", { weekday: "short" })}
                </span>
                <WIcon name={d.icon} size={18} className="text-slate-300" />
                <span className="text-xs font-medium text-slate-200">{d.max}°</span>
                <span className="text-xs text-slate-500">{d.min}°</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
