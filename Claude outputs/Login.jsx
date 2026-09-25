import { useState } from "react";
import { Activity, KeyRound, Loader2, Lock, Mail, User } from "lucide-react";
import { api } from "../api";

function Field({ icon: Icon, ...props }) {
  return (
    <div className="relative">
      <Icon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input className="input !pl-9" {...props} />
    </div>
  );
}

/**
 * Sign in / create account.
 * signupMode: "first" (no accounts yet: this becomes the owner), "invite" (needs a code) or "closed".
 */
export default function Login({ signupMode, onSuccess }) {
  const canSignup = signupMode !== "closed";
  const [mode, setMode] = useState(signupMode === "first" ? "signup" : "signin");
  const [form, setForm] = useState({ email: "", password: "", name: "", invite: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const signup = mode === "signup";

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = signup
        ? await api.signup({ email: form.email, password: form.password, name: form.name, invite_code: form.invite })
        : await api.login(form.email, form.password);
      onSuccess(res.user);
    } catch (err) {
      setError(err.status && err.detail ? err.detail : "Couldn't reach the server. It may be waking up; try again in a minute.");
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

        {canSignup && (
          <div className="flex gap-1 rounded-xl bg-slate-950 p-1">
            {[
              ["signin", "Sign in"],
              ["signup", "Create account"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMode(key);
                  setError("");
                }}
                className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-medium ${
                  mode === key ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {signup && signupMode === "first" && (
          <p className="rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-400">
            No accounts yet. This first account becomes the owner, and any existing tasks and notes move into it.
          </p>
        )}

        <div className="space-y-2.5">
          {signup && <Field icon={User} placeholder="Your name" value={form.name} onChange={set("name")} maxLength={60} />}
          <Field icon={Mail} type="email" placeholder="Email" autoComplete="email" autoFocus required value={form.email} onChange={set("email")} />
          <Field
            icon={Lock}
            type="password"
            placeholder={signup ? "Password (at least 8 characters)" : "Password"}
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={signup ? 8 : undefined}
            value={form.password}
            onChange={set("password")}
          />
          {signup && signupMode === "invite" && (
            <Field icon={KeyRound} placeholder="Invite code" required value={form.invite} onChange={set("invite")} />
          )}
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : signup ? "Create account" : "Sign in"}
        </button>
        <p className="text-xs text-slate-500">
          {signup && signupMode === "invite"
            ? "Ask the dashboard owner for the invite code. "
            : ""}
          You'll stay signed in on this device for 30 days.
        </p>
      </form>
    </div>
  );
}
