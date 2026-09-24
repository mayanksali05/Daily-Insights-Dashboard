import { RefreshCw, Sparkles } from "lucide-react";
import { api } from "../api";
import { useFetch } from "../hooks";
import { timeAgo } from "../utils";
import { ErrorNote, Loading, SectionTitle } from "./ui";

// Renders whatever /api/brief returns. Swapping the backend provider to an LLM
// requires no change here.
export default function BriefCard() {
  const { data, loading, error, reload } = useFetch(api.brief, [], 10 * 60 * 1000);

  return (
    <section className="card h-full">
      <SectionTitle
        icon={Sparkles}
        title="Today's Brief"
        right={
          <button className="icon-btn" onClick={() => reload()} title="Refresh" aria-label="Refresh brief">
            <RefreshCw size={14} />
          </button>
        }
      />
      {loading && <Loading />}
      {error && <ErrorNote onRetry={reload} message="Brief unavailable." />}
      {data && (
        <>
          <p className="text-base text-slate-100">{data.summary}</p>
          <ul className="mt-3 space-y-2">
            {data.bullets.map((b) => (
              <li key={b.url} className="flex gap-3 text-sm">
                <span className="mt-0.5 h-fit shrink-0 rounded-md bg-indigo-600/20 px-2 py-0.5 text-xs font-medium text-indigo-300">
                  {b.category}
                </span>
                <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white">
                  {b.text}
                  <span className="text-slate-500"> — {b.source}</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Generated {timeAgo(data.generated_at)} · {data.provider === "llm" ? "AI summary" : "Top headlines (AI summary not connected yet)"}
          </p>
        </>
      )}
    </section>
  );
}
