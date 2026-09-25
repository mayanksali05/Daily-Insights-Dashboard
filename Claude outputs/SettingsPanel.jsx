import { useState } from "react";
import { CheckCircle2, LogOut, Settings, UserRound } from "lucide-react";
import { api } from "../api";
import { MARKET_OPTIONS, NEWS_OPTIONS, SECTION_OPTIONS } from "../hooks";
import { SectionTitle, Toggle } from "./ui";

const toggleIn = (list, key, on) => (on ? [...list, key] : list.filter((k) => k !== key));

function NotionLogo() {
  return (
    <span className="flex h-4 w-4 items-center justify-center rounded-[3px] bg-slate-100 text-[10px] font-bold leading-none text-slate-900">
      N
    </span>
  );
}

function Status({ msg }) {
  if (!msg) return null;
  return <p className={`text-sm ${msg.ok ? "text-emerald-400" : "text-rose-300"}`}>{msg.text}</p>;
}

function NotionSettings({ user, onUserChanged }) {
  const [token, setToken] = useState("");
  const [page, setPage] = useState(user.notion.page || "Expenses");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const connected = user.notion.connected;

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.connectNotion(token, page);
      setToken("");
      setMsg({ ok: true, text: "Saved. The Expenses card updates within 30 seconds." });
      onUserChanged();
    } catch (err) {
      setMsg({ ok: false, text: err.detail || "Couldn't save." });
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    await api.disconnectNotion().catch(() => {});
    setMsg({ ok: true, text: "Notion disconnected." });
    onUserChanged();
  };

  return (
    <section className="card md:col-span-2">
      <SectionTitle
        icon={NotionLogo}
        title="Notion (Expenses card)"
        right={
          connected && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 size={14} /> Connected
            </span>
          )
        }
      />
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          Integration secret {connected && <span className="text-slate-500">(leave blank to keep the saved one)</span>}
          <input
            type="password"
            className="input mt-1"
            placeholder={connected ? "••••••••••••" : "ntn_…"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label className="block text-sm text-slate-300">
          Expenses page <span className="text-slate-500">(title or Notion link)</span>
          <input className="input mt-1" value={page} onChange={(e) => setPage(e.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={busy || (!connected && !token)}>
            {busy ? "Checking…" : connected ? "Save" : "Connect"}
          </button>
          {connected && (
            <button type="button" className="btn-ghost" onClick={disconnect}>
              Disconnect
            </button>
          )}
          <Status msg={msg} />
        </div>
      </form>
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-slate-500">
        <li>Go to notion.so/profile/integrations → New integration (Internal) → copy the secret.</li>
        <li>In Notion, open your expenses page → ••• → Connections → add that integration.</li>
        <li>Paste the secret above. It's stored encrypted and never shown again.</li>
      </ol>
    </section>
  );
}

function AccountSettings({ user, onLogout }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState(null);

  const change = async (e) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      setMsg({ ok: true, text: "Password changed. Other devices were signed out." });
    } catch (err) {
      setMsg({ ok: false, text: err.detail || "Couldn't change the password." });
    }
  };

  return (
    <section className="card md:col-span-2">
      <SectionTitle
        icon={UserRound}
        title="Account"
        right={
          <button className="btn-ghost" onClick={onLogout}>
            <LogOut size={15} /> Sign out
          </button>
        }
      />
      <p className="mb-3 text-sm text-slate-400">
        Signed in as <span className="text-slate-200">{user.email}</span>
        {user.is_admin && <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">Owner</span>}
      </p>
      <form onSubmit={change} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="block text-sm text-slate-300">
          Current password
          <input type="password" className="input mt-1" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </label>
        <label className="block text-sm text-slate-300">
          New password
          <input type="password" className="input mt-1" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required />
        </label>
        <button type="submit" className="btn-ghost border border-slate-800">
          Change password
        </button>
      </form>
      <div className="mt-2">
        <Status msg={msg} />
      </div>
    </section>
  );
}

export default function SettingsPanel({ settings, update, user, onLogout, onUserChanged }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card md:col-span-2">
        <SectionTitle icon={Settings} title="General" />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-300">
            Your name
            <input
              className="input mt-1"
              placeholder={user.name}
              value={settings.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </label>
          <label className="block text-sm text-slate-300">
            Weather city <span className="text-slate-500">(blank = server default)</span>
            <input
              className="input mt-1"
              placeholder="e.g. Ahmedabad"
              value={settings.city}
              onChange={(e) => update({ city: e.target.value })}
            />
          </label>
        </div>
        <div className="mt-3 sm:max-w-xs">
          <Toggle
            label="Dark mode"
            checked={settings.theme === "dark"}
            onChange={(on) => update({ theme: on ? "dark" : "light" })}
          />
        </div>
      </section>

      <NotionSettings user={user} onUserChanged={onUserChanged} />

      <section className="card">
        <SectionTitle title="Dashboard sections" />
        {SECTION_OPTIONS.map(({ key, label }) => (
          <Toggle
            key={key}
            label={label}
            checked={settings.sections[key]}
            onChange={(on) => update({ sections: { ...settings.sections, [key]: on } })}
          />
        ))}
      </section>

      <div className="space-y-4">
        <section className="card">
          <SectionTitle title="Market indices" />
          {MARKET_OPTIONS.map(({ key, label }) => (
            <Toggle
              key={key}
              label={label}
              checked={settings.markets.includes(key)}
              onChange={(on) => update({ markets: toggleIn(settings.markets, key, on) })}
            />
          ))}
        </section>
        <section className="card">
          <SectionTitle title="News categories" />
          {NEWS_OPTIONS.map(({ key, label }) => (
            <Toggle
              key={key}
              label={label}
              checked={settings.news.includes(key)}
              onChange={(on) => update({ news: toggleIn(settings.news, key, on) })}
            />
          ))}
        </section>
      </div>

      <AccountSettings user={user} onLogout={onLogout} />
      <p className="text-xs text-slate-500 md:col-span-2">
        Settings are saved to your account, so they follow you to the desktop widget and other browsers.
      </p>
    </div>
  );
}
