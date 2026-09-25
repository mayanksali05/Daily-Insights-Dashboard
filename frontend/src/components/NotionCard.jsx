import { useEffect } from "react";
import { ExternalLink, RefreshCw, Wallet } from "lucide-react";
import { api } from "../api";
import { useFetch, useNow } from "../hooks";
import { formatPrice, timeAgo } from "../utils";
import { ErrorNote, Loading, SectionTitle } from "./ui";

const POLL_MS = 30 * 1000;

function NotionLogo() {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-slate-100 text-[10px] font-bold leading-none text-slate-900">
      N
    </span>
  );
}

// This month's total from the Notion "Expenses" page. Polls every 30 s and on tab focus.
export default function NotionCard({ className = "", onOpenSettings }) {
  const { data, loading, error, reload } = useFetch(api.notionExpenses, [], POLL_MS);
  useNow(15000); // keep "edited 2m ago" current

  useEffect(() => {
    const onFocus = () => reload(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  return (
    <section className={`panel ${className}`}>
      <SectionTitle
        icon={NotionLogo}
        title="Expenses"
        right={
          <div className="flex items-center gap-2">
            {data?.found && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
              </span>
            )}
            <button className="icon-btn" onClick={() => reload()} title="Refresh" aria-label="Refresh expenses">
              <RefreshCw size={14} />
            </button>
          </div>
        }
      />
      <div className="panel-body flex flex-col">
        {loading && !data && <Loading />}
        {error && (
          <ErrorNote
            onRetry={reload}
            message={error.includes("Notion token") ? "Notion secret invalid. Reconnect it in Settings." : "Notion unavailable."}
          />
        )}

        {data && !data.configured && (
          <div className="space-y-2 text-sm text-slate-400">
            <p className="text-slate-300">Show this month's spending from your Notion expenses page.</p>
            <button className="btn-primary !py-1.5" onClick={onOpenSettings}>
              Connect Notion
            </button>
          </div>
        )}

        {data?.configured && !data.found && (
          <p className="text-sm text-slate-400">
            Couldn't find a Notion page named “{data.page}”. In Notion, add your integration to it (••• → Connections), or
            change the page name in{" "}
            <button className="underline hover:text-slate-200" onClick={onOpenSettings}>
              Settings
            </button>
            .
          </p>
        )}

        {data?.found && (
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-1 flex-col justify-center rounded-xl border border-slate-800 bg-slate-950/50 p-3 hover:border-slate-600"
            title={`Detected: ${data.method}`}
          >
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <Wallet size={13} /> Spent in {data.month}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-white">{formatPrice(data.total, "₹")}</p>
            <p className="mt-1 text-xs text-slate-500">
              {data.count} {data.count === 1 ? "entry" : "entries"}
              {data.last_edited && ` · edited ${timeAgo(data.last_edited)}`}
            </p>
            <p className="mt-2 flex items-center gap-1 text-xs text-slate-500 group-hover:text-indigo-300">
              Open {data.page} in Notion <ExternalLink size={12} />
            </p>
            {data.count === 0 && (
              <p className="mt-2 text-xs text-amber-300/80">
                Nothing counted for this month. Detected layout: {data.method}.
              </p>
            )}
          </a>
        )}
      </div>
    </section>
  );
}
