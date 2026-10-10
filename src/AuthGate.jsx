import { useState } from "react";
import {
  LockKeyhole,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  ShieldCheck,
  Store,
} from "lucide-react";

const API = "http://127.0.0.1:5000";

export default function AuthGate({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("retailer");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();

    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/api/auth/${mode === "setup" ? "setup" : "login"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: username.trim(),
            password,
            role,
            displayName: displayName.trim() || "Administrator",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      if (mode === "setup") {
        setMode("login");
        setPassword("");
        setShowPassword(false);
        setError(
          "Admin account created. Sign in with your new credentials."
        );
        return;
      }

      // Verify the selected role against the authenticated user.
      if (data.user?.role && data.user.role !== role) {
        throw new Error(
          `This account is not registered as ${role}. Select the correct role.`
        );
      }

      if (!data.token || !data.user) {
        throw new Error("The server returned an invalid login response.");
      }

      onLogin(data.token, data.user);
    } catch (err) {
      setError(err.message || "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  function changeMode() {
    setMode((previous) => (previous === "setup" ? "login" : "setup"));
    setError("");
    setPassword("");
    setShowPassword(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="px-6 pb-5 pt-8 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
              <LockKeyhole size={24} />
            </div>

            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Retail Price Optimizer
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Secure workspace access
              </p>
            </div>
          </div>

          <h2 className="mt-7 text-lg font-semibold text-slate-900">
            {mode === "setup"
              ? "Create initial administrator"
              : "Welcome back"}
          </h2>

          <p className="mt-1 text-sm leading-5 text-slate-500">
            {mode === "setup"
              ? "Create the initial administrator account."
              : "Choose your account type and sign in."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5 px-6 pb-8 sm:px-8">
          {/* Role selection */}
          {mode === "login" && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Sign in as
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setRole("admin");
                    setError("");
                  }}
                  aria-pressed={role === "admin"}
                  className={`flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition ${
                    role === "admin"
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/10"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      role === "admin"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <ShieldCheck size={21} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      Admin
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Platform access
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRole("retailer");
                    setError("");
                  }}
                  aria-pressed={role === "retailer"}
                  className={`flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition ${
                    role === "retailer"
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500/10"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      role === "retailer"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <Store size={21} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      Retailer
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Shop access
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Administrator display name */}
          {mode === "setup" && (
            <Field label="Administrator display name">
              <input
                autoComplete="name"
                required
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Enter your name"
                className="auth-input"
              />
            </Field>
          )}

          {/* Username */}
          <Field label="Username">
            <input
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter your username"
              className="auth-input"
            />
          </Field>

          {/* Password with show/hide */}
          <Field label="Password">
            <div className="relative">
              <input
                autoComplete={
                  mode === "setup" ? "new-password" : "current-password"
                }
                type={showPassword ? "text" : "password"}
                minLength={mode === "setup" ? 12 : 1}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="auth-input pr-12"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((previous) => !previous)
                }
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            {mode === "setup" && (
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                Use at least 12 characters.
              </p>
            )}
          </Field>

          {/* Error and success feedback */}
          {error && (
            <div
              role="alert"
              className={`rounded-xl border p-3 text-sm leading-5 ${
                error.startsWith("Admin account created")
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={busy}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mode === "setup" ? (
              <UserPlus size={18} />
            ) : (
              <LogIn size={18} />
            )}

            {busy
              ? "Please wait..."
              : mode === "setup"
                ? "Create admin account"
                : `Sign in as ${role === "admin" ? "Admin" : "Retailer"}`}
          </button>
        </form>

        {/* Initial setup */}
        <div className="border-t border-slate-100 px-6 py-4 text-center sm:px-8">
          <button
            type="button"
            onClick={changeMode}
            className="text-sm font-medium text-blue-700 transition hover:text-blue-800"
          >
            {mode === "setup"
              ? "Back to sign in"
              : "First run? Create initial admin"}
          </button>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Account permissions are verified by the server.
          </p>
        </div>
      </div>

      <style>{`
        .auth-input {
          box-sizing: border-box;
          display: block;
          width: 100%;
          min-height: 48px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          background: #ffffff;
          padding: 12px 14px;
          color: #0f172a;
          font-size: 14px;
          line-height: 22px;
          outline: none;
          transition: border-color 150ms ease, box-shadow 150ms ease;
        }

        .auth-input::placeholder {
          color: #94a3b8;
        }

        .auth-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgb(59 130 246 / 12%);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>

      {children}
    </div>
  );
}