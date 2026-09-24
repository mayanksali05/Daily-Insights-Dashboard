import { useCallback, useEffect, useRef, useState } from "react";

const SETTINGS_KEY = "dcc-settings";

export const MARKET_OPTIONS = [
  { key: "nifty50", label: "NIFTY 50" },
  { key: "sensex", label: "SENSEX" },
  { key: "sp500", label: "S&P 500" },
  { key: "nasdaq", label: "NASDAQ" },
  { key: "usdinr", label: "USD/INR" },
  { key: "btc", label: "BTC" },
];

export const NEWS_OPTIONS = [
  { key: "world", label: "World News" },
  { key: "india", label: "India News" },
  { key: "tech", label: "Technology" },
  { key: "ai", label: "AI News" },
];

export const SECTION_OPTIONS = [
  { key: "weather", label: "Weather" },
  { key: "markets", label: "Markets" },
  { key: "brief", label: "Today's Brief" },
  { key: "news", label: "News" },
  { key: "tasks", label: "Tasks" },
  { key: "notes", label: "Quick Notes" },
];

const DEFAULTS = {
  name: "Mayank",
  city: "",
  sections: { weather: true, markets: true, brief: true, news: true, tasks: true, notes: true },
  markets: MARKET_OPTIONS.map((m) => m.key),
  news: NEWS_OPTIONS.map((n) => n.key),
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { ...DEFAULTS, ...saved, sections: { ...DEFAULTS.sections, ...saved.sections } };
  } catch {
    return DEFAULTS;
  }
}

export function useSettings() {
  const [settings, setSettings] = useState(load);
  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable - keep in memory */
      }
      return next;
    });
  }, []);
  return [settings, update];
}

// Fetch on mount / when `deps` change, with optional polling.
export function useFetch(fn, deps = [], intervalMs = 0) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = useCallback(async (silent = false) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ data: silent ? s.data : null, loading: false, error: e.message }));
    }
  }, []);

  useEffect(() => {
    load();
    if (!intervalMs) return;
    const id = setInterval(() => load(true), intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: load };
}

export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
