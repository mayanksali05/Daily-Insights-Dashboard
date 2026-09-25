import { useCallback, useEffect, useRef, useState } from "react";

const SETTINGS_KEY = "dcc-settings";

export const MARKET_OPTIONS = [
  { key: "gold", label: "Gold (24K, per 10 g)" },
  { key: "silver", label: "Silver (per kg)" },
];

export const NEWS_OPTIONS = [
  { key: "headlines", label: "World & India News" },
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
  { key: "notion", label: "Expenses (Notion)" },
];

const DEFAULTS = {
  name: "", // empty = use the account's name
  theme: "light", // "light" | "dark"
  city: "",
  sections: { weather: true, markets: true, brief: true, news: true, tasks: true, notes: true, notion: true },
  markets: MARKET_OPTIONS.map((m) => m.key),
  news: NEWS_OPTIONS.map((n) => n.key),
};

// Merge saved values onto the defaults, dropping options that no longer exist.
function normalize(saved = {}) {
  const valid = MARKET_OPTIONS.map((m) => m.key);
  const kept = Array.isArray(saved.markets) ? saved.markets.filter((k) => valid.includes(k)) : [];
  const markets = kept.length ? kept : DEFAULTS.markets;
  // Old "world"/"india" choices become the combined "headlines" section.
  const newsKeys = NEWS_OPTIONS.map((n) => n.key);
  let news = DEFAULTS.news;
  if (Array.isArray(saved.news)) {
    const mapped = saved.news.map((k) => (k === "world" || k === "india" ? "headlines" : k));
    news = newsKeys.filter((k) => mapped.includes(k));
  }
  return { ...DEFAULTS, ...saved, markets, news, sections: { ...DEFAULTS.sections, ...saved.sections } };
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCache(value) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
  } catch {
    /* storage unavailable - keep in memory */
  }
}

/**
 * Dashboard preferences, saved to the signed-in account (so they follow you to the
 * desktop widget and other browsers) and cached locally for a flash-free first paint.
 * `serverSettings` comes from /api/auth/status; `save` persists to the server.
 */
export function useSettings(serverSettings, save) {
  const [settings, setSettings] = useState(() => {
    const hasServer = serverSettings && Object.keys(serverSettings).length > 0;
    return normalize(hasServer ? serverSettings : readCache());
  });
  const timer = useRef(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  // First sign-in after accounts were added: upload this browser's existing preferences.
  useEffect(() => {
    if (!serverSettings || Object.keys(serverSettings).length === 0) saveRef.current?.(settings);
    writeCache(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      writeCache(next);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => saveRef.current?.(next), 600);
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
