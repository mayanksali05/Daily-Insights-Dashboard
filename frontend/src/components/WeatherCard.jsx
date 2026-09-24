import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, Sun, Wind } from "lucide-react";
import { api } from "../api";
import { useFetch } from "../hooks";
import { ErrorNote, Loading } from "./ui";

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

// Compact horizontal weather card for the first row: current conditions + 5-day strip.
export default function WeatherCard({ city }) {
  const { data, loading, error, reload } = useFetch(() => api.weather(city), [city], 15 * 60 * 1000);

  return (
    <section className="card flex min-w-0 basis-full flex-wrap items-center gap-x-4 gap-y-3 !p-3 sm:basis-0 sm:flex-1 xl:flex-none xl:basis-auto xl:flex-nowrap xl:gap-x-5 xl:px-5">
      {loading && <Loading />}
      {error && <ErrorNote onRetry={reload} message="Weather unavailable." />}
      {data && (
        <>
          <div className="flex items-center gap-3">
            <WIcon name={data.icon} size={40} className="shrink-0 text-amber-300" />
            <p className="text-3xl font-semibold text-white">{data.temperature}°</p>
            <div className="text-sm">
              <p className="font-medium text-slate-200">
                {data.city}
                {data.country ? `, ${data.country}` : ""}
              </p>
              <p className="text-slate-400">
                {data.label} · feels {data.feels_like}°
              </p>
              <p className="mt-0.5 flex gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Droplets size={12} /> {data.humidity}%</span>
                <span className="flex items-center gap-1"><Wind size={12} /> {data.wind_kmh} km/h</span>
              </p>
            </div>
          </div>
          <div className="ml-auto grid shrink-0 grid-cols-5 gap-2 sm:gap-3 xl:ml-0 xl:border-l xl:border-slate-800 xl:pl-4">
            {data.forecast.map((d, i) => (
              <div key={d.date} className="flex flex-col items-center gap-0.5 text-center">
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
