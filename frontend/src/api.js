// All calls go through the FastAPI backend; the browser never sees third-party API keys.
const BASE = import.meta.env.VITE_API_URL || "";

// Fired when the session has expired so App can show the sign-in screen.
export const UNAUTHORIZED_EVENT = "dcc:unauthorized";

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).detail || "";
    } catch {
      /* not JSON */
    }
    const err = new Error(`Request failed (${res.status})${detail ? `: ${detail}` : ""}`);
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  authStatus: () => request("/api/auth/status"),
  login: (password) => request("/api/auth/login", { method: "POST", body: { password } }),
  logout: () => request("/api/auth/logout", { method: "POST" }),

  weather: (city) => request(`/api/weather${city ? `?city=${encodeURIComponent(city)}` : ""}`),
  markets: (keys) => request(`/api/markets?symbols=${keys.join(",")}`),
  news: (category, limit = 4) => request(`/api/news/${category}?limit=${limit}`),
  brief: () => request("/api/brief"),
  notionRecent: (limit = 10) => request(`/api/notion/recent?limit=${limit}`),
  notionExpenses: () => request("/api/notion/expenses"),

  listTasks: () => request("/api/tasks"),
  createTask: (body) => request("/api/tasks", { method: "POST", body }),
  updateTask: (id, body) => request(`/api/tasks/${id}`, { method: "PATCH", body }),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: "DELETE" }),

  listNotes: () => request("/api/notes"),
  createNote: (body) => request("/api/notes", { method: "POST", body }),
  updateNote: (id, body) => request(`/api/notes/${id}`, { method: "PATCH", body }),
  deleteNote: (id) => request(`/api/notes/${id}`, { method: "DELETE" }),
};
