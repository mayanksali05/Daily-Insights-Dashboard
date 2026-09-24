import { useState } from "react";
import { Activity, Loader2, Lock } from "lucide-react";
import { api } from "../api";

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError("");
    try {
      await api.login(password);
      onSuccess();
    } catch (err) {
      setError(err.status === 429 ? err.detail : err.status === 401 ? "Wrong password." : "Couldn't reach the server.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2 text-white">
          <Activity size={20} />
          <h1 className="text-lg font-semibold">Daily Command Center</h1>
        </div>
        <label className="block text-sm text-slate-400">
          Password
          <div className="relative mt-1">
            <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              className="input !pl-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </label>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy || !password}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Sign in"}
        </button>
        <p className="text-xs text-slate-500">You'll stay signed in on this device for 30 days.</p>
      </form>
    </div>
  );
}
