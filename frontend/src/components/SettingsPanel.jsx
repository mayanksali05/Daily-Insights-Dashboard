import { Settings } from "lucide-react";
import { MARKET_OPTIONS, NEWS_OPTIONS, SECTION_OPTIONS } from "../hooks";
import { SectionTitle, Toggle } from "./ui";

const toggleIn = (list, key, on) => (on ? [...list, key] : list.filter((k) => k !== key));

export default function SettingsPanel({ settings, update }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card md:col-span-2">
        <SectionTitle icon={Settings} title="General" />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-300">
            Your name
            <input className="input mt-1" value={settings.name} onChange={(e) => update({ name: e.target.value })} />
          </label>
          <label className="block text-sm text-slate-300">
            Weather city <span className="text-slate-500">(blank = server default)</span>
            <input
              className="input mt-1"
              placeholder="e.g. Ahmedabad"
              value={settings.city}
              onChange={(e) => update({ city: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="card">
        <SectionTitle title="Dashboard sections" />
        {SECTION_OPTIONS.map(({ key, label }) => (
          <Toggle
            key={key}
            label={label}
            checked={settings.sections[key]}
            onChange={(on) => update({ sections: { ...settings.sections, [key]: on } })}
          />
        ))}
      </section>

      <div className="space-y-4">
        <section className="card">
          <SectionTitle title="Market indices" />
          {MARKET_OPTIONS.map(({ key, label }) => (
            <Toggle
              key={key}
              label={label}
              checked={settings.markets.includes(key)}
              onChange={(on) => update({ markets: toggleIn(settings.markets, key, on) })}
            />
          ))}
        </section>
        <section className="card">
          <SectionTitle title="News categories" />
          {NEWS_OPTIONS.map(({ key, label }) => (
            <Toggle
              key={key}
              label={label}
              checked={settings.news.includes(key)}
              onChange={(on) => update({ news: toggleIn(settings.news, key, on) })}
            />
          ))}
        </section>
      </div>
      <p className="text-xs text-slate-500 md:col-span-2">Settings are saved in this browser automatically.</p>
    </div>
  );
}
