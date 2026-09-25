// "Now playing" for the widget: runs media/nowplaying.ps1 (Windows PowerShell) in the background.
// It reports what Windows' media session is playing (YouTube Music in any browser, Spotify, ...)
// and takes play/pause/next/previous commands. Windows only; elsewhere it reports "unsupported".
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const COMMANDS = new Set(["toggle", "next", "previous"]);

class NowPlaying {
  /** @param {{ scriptDir: string, onChange: (snapshot) => void, log?: (msg: string) => void }} opts */
  constructor({ scriptDir, onChange, log = () => {} }) {
    this.scriptDir = scriptDir;
    this.onChange = onChange;
    this.log = log;
    this.state = null; // latest {active, title, artist, status, ...}
    this.art = null; // {key, url}
    this.unsupported = false;
    this.child = null;
    this.stopped = false;
    this.restartDelay = 5000;
    this.restartTimer = null;
  }

  snapshot() {
    if (this.unsupported) return { unsupported: true };
    if (!this.state) return null;
    const art = this.art && this.art.key === this.state.artKey ? this.art.url : null;
    return { ...this.state, art };
  }

  start() {
    if (process.platform !== "win32" && !process.env.DCC_NOWPLAYING_CMD) {
      this.unsupported = true;
      this.onChange(this.snapshot());
      return;
    }
    this.stopped = false;
    this.spawn();
  }

  scriptPath() {
    // PowerShell can't read files inside the app's .asar archive, so copy the script out.
    const src = path.join(__dirname, "media", "nowplaying.ps1");
    const dst = path.join(this.scriptDir, "nowplaying.ps1");
    const body = fs.readFileSync(src);
    let current = null;
    try {
      current = fs.readFileSync(dst);
    } catch {
      /* not there yet */
    }
    if (!current || !current.equals(body)) {
      fs.mkdirSync(this.scriptDir, { recursive: true });
      fs.writeFileSync(dst, body);
    }
    return dst;
  }

  spawn() {
    let cmd;
    let args;
    try {
      if (process.env.DCC_NOWPLAYING_CMD) {
        // tests: a fake helper that speaks the same line protocol
        [cmd, ...args] = JSON.parse(process.env.DCC_NOWPLAYING_CMD);
      } else {
        cmd = "powershell.exe"; // Windows PowerShell 5.1: has WinRT access (pwsh 7 doesn't)
        args = ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", this.scriptPath()];
      }
    } catch (err) {
      this.log(`now playing: ${err.message}`);
      return;
    }

    const startedAt = Date.now();
    const child = spawn(cmd, args, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    this.child = child;

    readline.createInterface({ input: child.stdout }).on("line", (line) => this.handleLine(line));
    let errText = "";
    child.stderr.on("data", (d) => {
      if (errText.length < 2000) errText += d.toString();
    });
    child.on("error", (err) => this.log(`now playing: ${err.message}`));
    child.on("exit", (code) => {
      if (this.child === child) this.child = null;
      if (errText.trim()) this.log(`now playing helper stderr: ${errText.trim().slice(0, 500)}`);
      if (this.stopped || this.unsupported) return;
      // Crashed or killed: restart, backing off if it keeps failing quickly.
      this.restartDelay = Date.now() - startedAt > 60000 ? 5000 : Math.min(this.restartDelay * 2, 60000);
      this.log(`now playing helper exited (${code}); restarting in ${this.restartDelay / 1000}s`);
      this.restartTimer = setTimeout(() => this.spawn(), this.restartDelay);
    });
  }

  handleLine(line) {
    let msg;
    try {
      msg = JSON.parse(line.replace(/^﻿/, ""));
    } catch {
      return;
    }
    if (msg.type === "state") {
      const { type, ...state } = msg;
      this.state = state;
    } else if (msg.type === "art") {
      if (msg.error) this.log(`now playing: no album art (${msg.error})`);
      this.art = { key: String(msg.key), url: typeof msg.url === "string" && msg.url.startsWith("data:image/") ? msg.url : null };
    } else if (msg.type === "unsupported") {
      this.unsupported = true;
      this.log(`now playing unsupported: ${msg.message || ""}`);
    } else if (msg.type === "error") {
      this.log(`now playing error: ${msg.message || ""}`);
      return;
    } else {
      return;
    }
    this.onChange(this.snapshot());
  }

  command(cmd) {
    if (!COMMANDS.has(cmd) || !this.child) return false;
    this.child.stdin.write(`${cmd}\n`);
    return true;
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.restartTimer);
    if (this.child) {
      this.child.stdin.end(); // the helper exits when its input closes
      const child = this.child;
      setTimeout(() => child.exitCode === null && child.kill(), 1500).unref();
    }
  }
}

module.exports = { NowPlaying, COMMANDS };
