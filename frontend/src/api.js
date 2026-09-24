// All calls go through the FastAPI backend; the browser never sees third-party API keys.
const BASE = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.status === 204 ? null : res.json();
}

export const api = {
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
