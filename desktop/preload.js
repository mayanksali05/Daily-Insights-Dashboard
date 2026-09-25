// Gives the dashboard page a small, safe bridge to the widget: "now playing" info and media controls.
// The website checks for window.dccDesktop to know it's running inside the desktop app.
const { contextBridge, ipcRenderer } = require("electron");

let latest = null;
const listeners = new Set();

function emit() {
  for (const fn of listeners) {
    try {
      fn(latest);
    } catch {
      /* a broken listener shouldn't stop the others */
    }
  }
}

ipcRenderer.on("now-playing", (_event, snapshot) => {
  latest = snapshot;
  emit();
});

contextBridge.exposeInMainWorld("dccDesktop", {
  version: 1,
  nowPlaying: {
    // Calls fn(snapshot) now and on every change; returns an unsubscribe function.
    subscribe(fn) {
      if (typeof fn !== "function") return () => {};
      listeners.add(fn);
      ipcRenderer.invoke("now-playing:get").then((snapshot) => {
        latest = snapshot;
        if (listeners.has(fn)) emit();
      });
      return () => listeners.delete(fn);
    },
    // "toggle" | "next" | "previous"
    command(cmd) {
      ipcRenderer.send("now-playing:command", String(cmd));
    },
  },
});
