// Daily Command Center — desktop widget.
// A frameless window that shows the hosted dashboard, with a tray icon for options.
// Sign-in, data and updates all come from the website, so the widget rarely needs reinstalling.
const { app, BrowserWindow, Menu, Tray, nativeImage, screen, shell, globalShortcut } = require("electron");
const fs = require("fs");
const path = require("path");

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const DASHBOARD_URL = (process.env.DCC_URL || CONFIG.dashboardUrl).replace(/\/+$/, "");
const DASHBOARD_ORIGIN = new URL(DASHBOARD_URL).origin;
const RETRY_SECONDS = 20;
const ZOOM_STEPS = [0.6, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25];

let win = null;
let tray = null;
let retryTimer = null;
let quitting = false;

// ---------- preferences (window position, options) ----------
const PREFS_FILE = path.join(app.getPath("userData"), "widget-prefs.json");
const DEFAULT_PREFS = { bounds: null, alwaysOnTop: false, showInTaskbar: false, zoom: 1, firstRun: true };
let prefs = { ...DEFAULT_PREFS };
try {
  prefs = { ...DEFAULT_PREFS, ...JSON.parse(fs.readFileSync(PREFS_FILE, "utf8")) };
} catch {
  /* first run */
}
let saveTimer = null;
function savePrefs() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2));
    } catch {
      /* ignore */
    }
  }, 300);
}

// ---------- window ----------
function defaultBounds() {
  const { workArea } = screen.getPrimaryDisplay();
  const width = Math.min(1500, Math.round(workArea.width * 0.9));
  const height = Math.min(900, Math.round(workArea.height * 0.9));
  return {
    width,
    height,
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
  };
}

function boundsOnScreen(b) {
  if (!b) return false;
  return screen.getAllDisplays().some(({ workArea: w }) =>
    b.x < w.x + w.width - 100 && b.x + b.width > w.x + 100 && b.y >= w.y - 10 && b.y < w.y + w.height - 50
  );
}

// Lets the frameless window be dragged by its header / top strip.
const DRAG_CSS = `
  body::before { content: ""; position: fixed; top: 0; left: 0; right: 0; height: 12px;
                 -webkit-app-region: drag; z-index: 2147483647; }
  header { -webkit-app-region: drag; }
  header button, header a, header input, header [role="switch"] { -webkit-app-region: no-drag; }
`;

function isDashboard(url) {
  try {
    return new URL(url).origin === DASHBOARD_ORIGIN;
  } catch {
    return false;
  }
}

function loadDashboard() {
  clearTimeout(retryTimer);
  win.loadURL(DASHBOARD_URL).catch(() => {
    /* handled in did-fail-load */
  });
}

function createWindow() {
  const bounds = boundsOnScreen(prefs.bounds) ? prefs.bounds : defaultBounds();
  win = new BrowserWindow({
    ...bounds,
    minWidth: 520,
    minHeight: 420,
    frame: false,
    show: false,
    skipTaskbar: !prefs.showInTaskbar,
    alwaysOnTop: prefs.alwaysOnTop,
    backgroundColor: "#f3f3f3",
    title: "Daily Command Center",
    icon: path.join(__dirname, "build", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  // No camera/mic/notifications/etc. for the website.
  win.webContents.session.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));

  // Links to other sites (news articles, Notion) open in the normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("file:") || isDashboard(url)) return;
    event.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
  });

  win.webContents.on("did-finish-load", () => {
    win.webContents.setZoomFactor(prefs.zoom);
    if (isDashboard(win.webContents.getURL())) win.webContents.insertCSS(DRAG_CSS);
  });

  // Server unreachable (offline, or still waking up): show a friendly page and retry.
  win.webContents.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* aborted */ || !isDashboard(url)) return;
    win.loadFile(path.join(__dirname, "pages", "offline.html"), {
      query: { url: DASHBOARD_URL, retry: String(RETRY_SECONDS) },
    });
    retryTimer = setTimeout(loadDashboard, RETRY_SECONDS * 1000);
  });

  // Keyboard shortcuts (there's no menu bar in a frameless window).
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown") return;
    const ctrl = input.control || input.meta;
    if (input.key === "F5" || (ctrl && input.key.toLowerCase() === "r")) {
      loadDashboard();
      event.preventDefault();
    } else if (ctrl && (input.key === "=" || input.key === "+")) {
      stepZoom(+1);
      event.preventDefault();
    } else if (ctrl && input.key === "-") {
      stepZoom(-1);
      event.preventDefault();
    } else if (ctrl && input.key === "0") {
      setZoom(1);
      event.preventDefault();
    }
  });

  const rememberBounds = () => {
    if (!win.isMinimized() && !win.isMaximized()) {
      prefs.bounds = win.getBounds();
      savePrefs();
    }
  };
  win.on("moved", rememberBounds);
  win.on("resized", rememberBounds);

  // Closing (Alt+F4) hides to the tray; "Quit" in the tray really exits.
  win.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.once("ready-to-show", () => win.show());

  // Show the "waking up" page first: Render's free plan can take ~1 minute to start.
  win.loadFile(path.join(__dirname, "pages", "loading.html")).then(loadDashboard);
}

function toggleWindow() {
  if (!win) return;
  if (win.isVisible() && !win.isMinimized()) win.hide();
  else {
    win.show();
    win.focus();
  }
}

function setZoom(z) {
  prefs.zoom = z;
  savePrefs();
  win?.webContents.setZoomFactor(z);
  buildTrayMenu();
}

function stepZoom(dir) {
  const i = ZOOM_STEPS.findIndex((z) => Math.abs(z - prefs.zoom) < 0.01);
  const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, (i < 0 ? 5 : i) + dir))];
  setZoom(next);
}

// ---------- tray ----------
function buildTrayMenu() {
  if (!tray) return;
  const startAtLogin = app.getLoginItemSettings().openAtLogin;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show / hide   (Ctrl+Shift+D)", click: toggleWindow },
      { label: "Reload   (F5)", click: loadDashboard },
      { type: "separator" },
      {
        label: "Always on top",
        type: "checkbox",
        checked: prefs.alwaysOnTop,
        click: (item) => {
          prefs.alwaysOnTop = item.checked;
          win.setAlwaysOnTop(item.checked);
          savePrefs();
        },
      },
      {
        label: "Show in taskbar",
        type: "checkbox",
        checked: prefs.showInTaskbar,
        click: (item) => {
          prefs.showInTaskbar = item.checked;
          win.setSkipTaskbar(!item.checked);
          savePrefs();
        },
      },
      {
        label: "Start with Windows",
        type: "checkbox",
        checked: startAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      {
        label: "Zoom",
        submenu: ZOOM_STEPS.map((z) => ({
          label: `${Math.round(z * 100)}%`,
          type: "radio",
          checked: Math.abs(z - prefs.zoom) < 0.01,
          click: () => setZoom(z),
        })),
      },
      {
        label: "Reset size and position",
        click: () => {
          win.setBounds(defaultBounds());
          win.show();
        },
      },
      { type: "separator" },
      { label: "Open in browser", click: () => shell.openExternal(DASHBOARD_URL) },
      {
        label: "Quit",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ])
  );
}

function createTray() {
  const image = nativeImage.createFromPath(path.join(__dirname, "build", "icon.png")).resize({ width: 16, height: 16 });
  tray = new Tray(image);
  tray.setToolTip("Daily Command Center");
  tray.on("click", toggleWindow);
  buildTrayMenu();
}

// ---------- app lifecycle ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    app.setAppUserModelId("com.dailycommandcenter.widget");
    Menu.setApplicationMenu(null);
    if (prefs.firstRun) {
      // Behave like a widget out of the box: start with Windows.
      app.setLoginItemSettings({ openAtLogin: true });
      prefs.firstRun = false;
      savePrefs();
    }
    createWindow();
    createTray();
    globalShortcut.register("CommandOrControl+Shift+D", toggleWindow);
  });

  app.on("before-quit", () => {
    quitting = true;
  });
  app.on("will-quit", () => globalShortcut.unregisterAll());
  app.on("window-all-closed", (e) => e.preventDefault()); // keep running in the tray
}
