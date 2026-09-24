import { Cpu, ExternalLink, Globe, MapPin, Sparkles } from "lucide-react";
import { api } from "../api";
import { useFetch } from "../hooks";
import { timeAgo } from "../utils";
import { ErrorNote, Loading, SectionTitle } from "./ui";

const META = {
  headlines: { title: "World & India News", icon: Globe, limit: 8 },
  world: { title: "World News", icon: Globe },
  india: { title: "India News", icon: MapPin },
  tech: { title: "Technology", icon: Cpu },
  ai: { title: "AI News", icon: Sparkles },
};

export function NewsSection({ category, className = "" }) {
  const { title, icon, limit = 4 } = META[category];
  const { data, loading, error, reload } = useFetch(() => api.news(category, limit), [category], 10 * 60 * 1000);

  return (
    <section className={`panel ${className}`}>
      <SectionTitle icon={icon} title={title} />
      <div
        className={`panel-body grid content-start gap-2 ${category === "headlines" ? "sm:grid-cols-2" : ""}`}
      >
        {loading && <Loading />}
        {error && <ErrorNote onRetry={reload} message="News unavailable." />}
        {data && data.length === 0 && <p className="text-sm text-slate-500">No stories right now.</p>}
        {data?.map((n) => (
          <a
            key={n.url}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-xl border border-slate-800 bg-slate-950/50 p-2.5 transition-colors hover:border-slate-600"
          >
            <h3 className="flex items-start justify-between gap-2 text-[13px] font-medium leading-snug text-slate-100 group-hover:text-indigo-300">
              <span className="line-clamp-2">{n.title}</span>
              <ExternalLink size={13} className="mt-0.5 shrink-0 text-slate-600 group-hover:text-indigo-300" />
            </h3>
            {n.description && <p className="mt-0.5 line-clamp-2 text-xs text-slate-400 xl:line-clamp-1">{n.description}</p>}
            <p className="mt-1 text-xs text-slate-500">
              {n.tag && (
                <span
                  className={`mr-1.5 rounded px-1.5 py-0.5 font-medium ${
                    n.tag === "India" ? "bg-orange-500/15 text-orange-300" : "bg-sky-500/15 text-sky-300"
                  }`}
                >
                  {n.tag}
                </span>
              )}
              {n.source}
              {n.published_at && ` · ${timeAgo(n.published_at)}`}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}

// On xl screens the sections sit side by side in one row and each scrolls internally.
export default function NewsSections({ categories, className = "" }) {
  if (!categories.length) return null;
  return (
    <div
      className={`grid min-w-0 gap-3 md:grid-cols-2 xl:min-h-0 xl:grid-flow-col xl:auto-cols-fr xl:grid-cols-none xl:grid-rows-1 ${className}`}
    >
      {categories.map((c) => (
        <NewsSection key={c} category={c} className={c === "headlines" ? "md:col-span-2" : ""} />
      ))}
    </div>
  );
}
