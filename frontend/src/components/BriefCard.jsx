import { RefreshCw, Sparkles } from "lucide-react";
import { api } from "../api";
import { useFetch } from "../hooks";
import { timeAgo } from "../utils";
import { ErrorNote, Loading, SectionTitle } from "./ui";

// Renders whatever /api/brief returns. Swapping the backend provider to an LLM
// requires no change here.
export default function BriefCard({ className = "" }) {
  const { data, loading, error, reload } = useFetch(api.brief, [], 10 * 60 * 1000);

  return (
    <section className={`panel ${className}`}>
      <SectionTitle
        icon={Sparkles}
        title="Today's Brief"
        right={
          <div className="flex items-center gap-2">
            {data && (
              <span
                className="whitespace-nowrap text-xs text-slate-500"
                title={data.provider === "llm" ? "AI summary" : "Top headlines (AI summary not connected yet)"}
              >
                {timeAgo(data.generated_at)}
              </span>
            )}
            <button className="icon-btn" onClick={() => reload()} title="Refresh" aria-label="Refresh brief">
              <RefreshCw size={14} />
            </button>
          </div>
        }
      />
      <div className="panel-body">
        {loading && <Loading />}
        {error && <ErrorNote onRetry={reload} message="Brief unavailable." />}
        {data && (
          <>
            <p className="text-sm text-slate-100">{data.summary}</p>
            <ul className="mt-2 space-y-1.5">
              {data.bullets.map((b) => (
                <li key={b.url} className="flex gap-3 text-sm">
                  <span className="mt-0.5 h-fit shrink-0 rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-200">
                    {b.category}
                  </span>
                  <a href={b.url} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white">
                    {b.text}
                    <span className="text-slate-500"> — {b.source}</span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
