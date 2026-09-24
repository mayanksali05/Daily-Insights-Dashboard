import { Cpu, ExternalLink, Globe, MapPin, Sparkles } from "lucide-react";
import { api } from "../api";
import { useFetch } from "../hooks";
import { timeAgo } from "../utils";
import { ErrorNote, Loading, SectionTitle } from "./ui";

const META = {
  world: { title: "World News", icon: Globe },
  india: { title: "India News", icon: MapPin },
  tech: { title: "Technology", icon: Cpu },
  ai: { title: "AI News", icon: Sparkles },
};

function NewsSection({ category }) {
  const { title, icon } = META[category];
  const { data, loading, error, reload } = useFetch(() => api.news(category, 4), [category], 10 * 60 * 1000);

  return (
    <section className="card">
      <SectionTitle icon={icon} title={title} />
      {loading && <Loading />}
      {error && <ErrorNote onRetry={reload} message="News unavailable." />}
      {data && data.length === 0 && <p className="text-sm text-slate-500">No stories right now.</p>}
      <div className="space-y-3">
        {data?.map((n) => (
          <a
            key={n.url}
            href={n.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-xl border border-slate-800 bg-slate-950/50 p-3 transition-colors hover:border-slate-600"
          >
            <h3 className="flex items-start justify-between gap-2 text-sm font-medium text-slate-100 group-hover:text-indigo-300">
              {n.title}
              <ExternalLink size={14} className="mt-0.5 shrink-0 text-slate-600 group-hover:text-indigo-300" />
            </h3>
            {n.description && <p className="mt-1 line-clamp-2 text-xs text-slate-400">{n.description}</p>}
            <p className="mt-2 text-xs text-slate-500">
              {n.source}
              {n.published_at && ` · ${timeAgo(n.published_at)}`}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}

export default function NewsSections({ categories }) {
  if (!categories.length) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {categories.map((c) => (
        <NewsSection key={c} category={c} />
      ))}
    </div>
  );
}
