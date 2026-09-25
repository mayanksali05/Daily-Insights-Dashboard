import { useEffect, useState } from "react";
import { Download, Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useNow } from "../hooks";

// Set by the desktop widget's preload script; absent in a normal browser.
const bridge = typeof window !== "undefined" ? window.dccDesktop?.nowPlaying : undefined;
const RELEASES_URL = "https://github.com/mayanksali05/Daily-Insights-Dashboard/releases/latest";
const BOX = "card flex min-w-0 basis-full gap-3 !p-3 xl:basis-auto xl:shrink-0";

const APPS = [
  ["youtube-music", "YouTube Music"],
  ["ytmusic", "YouTube Music"],
  ["spotify", "Spotify"],
  ["brave", "Brave"],
  ["msedge", "Edge"],
  ["chrome", "Chrome"],
  ["firefox", "Firefox"],
  ["opera", "Opera"],
];
function appName(id = "") {
  const lower = id.toLowerCase();
  return APPS.find(([k]) => lower.includes(k))?.[1] || "";
}

function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

// What's playing on this PC (YouTube Music in any browser, Spotify, ...), read from Windows by the desktop widget.
export default function NowPlayingCard({ className = "" }) {
  const [np, setNp] = useState(bridge ? undefined : null);
  useEffect(() => (bridge ? bridge.subscribe((s) => setNp(s || null)) : undefined), []);

  if (!bridge) return <WebFallback className={className} />;
  if (np?.unsupported) return <Idle className={className} line="Needs Windows 10 or later." />;
  if (!np || !np.active) return <Idle className={className} line="Play something in YouTube Music and it shows up here." />;
  return <Player np={np} className={className} />;
}

function Player({ np, className }) {
  const playing = np.status === "Playing";
  const now = useNow(playing ? 1000 : 60000);
  const hasTime = np.duration > 1;
  let pos = np.position || 0;
  if (playing && np.updated > 0) pos += (now.getTime() - np.updated) / 1000;
  pos = hasTime ? Math.min(Math.max(pos, 0), np.duration) : 0;
  const pct = hasTime ? (pos / np.duration) * 100 : 0;
  const source = appName(np.app);

  const cmd = (c) => bridge.command(c);

  return (
    <section className={`${BOX} xl:w-80 ${className}`} aria-label="Now playing" title={source ? `Playing in ${source}` : undefined}>
      <Art src={np.art} />
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white" title={np.title}>{np.title}</p>
          <p className="truncate text-xs text-slate-400" title={np.artist}>
            {np.artist || source || " "}
          </p>
        </div>
        <div>
          <div className="h-1 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-slate-300 transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <div className="-ml-1.5 flex items-center gap-0.5">
              <button className="icon-btn disabled:opacity-40" onClick={() => cmd("previous")} disabled={!np.canPrev} aria-label="Previous track">
                <SkipBack size={16} />
              </button>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-900 hover:bg-slate-200 disabled:opacity-40"
                onClick={() => cmd("toggle")}
                disabled={np.canToggle === false}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="ml-0.5" />}
              </button>
              <button className="icon-btn disabled:opacity-40" onClick={() => cmd("next")} disabled={!np.canNext} aria-label="Next track">
                <SkipForward size={16} />
              </button>
            </div>
            {hasTime && (
              <span className="text-[11px] tabular-nums text-slate-500">
                {fmt(pos)} / {fmt(np.duration)}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Art({ src }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  return (
    <div className="flex aspect-square h-[6.5rem] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-950 text-slate-500">
      {src && !broken ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <Music2 size={28} />
      )}
    </div>
  );
}

function Idle({ line, className }) {
  return (
    <section className={`${BOX} items-center xl:w-72 ${className}`} aria-label="Now playing">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-slate-500">
        <Music2 size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200">Nothing playing</p>
        <p className="mt-0.5 text-xs leading-snug text-slate-500">{line}</p>
      </div>
    </section>
  );
}

// In a normal browser the page can't see other apps, so point to the desktop app.
// Hidden on phones, where the desktop app doesn't apply.
function WebFallback({ className }) {
  return (
    <section className={`${BOX} items-center max-sm:hidden xl:w-72 ${className}`} aria-label="Now playing">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-slate-500">
        <Music2 size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200">Now playing</p>
        <p className="mt-0.5 text-xs leading-snug text-slate-500">Shows your music and controls in the desktop app.</p>
        <a
          href={RELEASES_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:underline"
        >
          <Download size={12} /> Get the app
        </a>
      </div>
    </section>
  );
}
