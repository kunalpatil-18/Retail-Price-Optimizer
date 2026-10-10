
import { ShieldCheck, Store, LogOut } from "lucide-react";

export default function Topbar({ user, onLogout }) {
  const isAdmin = user?.role === "admin";

  return (
    <header className="sticky top-0 z-10 flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-5 py-3 backdrop-blur sm:px-8">
      <div>
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
          Retail Price Optimizer
        </h2>
        <p className="text-xs text-slate-500 sm:text-sm">
          {isAdmin
            ? "Platform and account administration"
            : "Pricing, inventory and sales intelligence for your shop"}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 sm:flex">
          {isAdmin ? (
            <ShieldCheck size={17} className="text-blue-600" />
          ) : (
            <Store size={17} className="text-blue-600" />
          )}

          <div>
            <p className="max-w-40 truncate text-sm font-semibold text-slate-800">
              {user?.displayName || user?.username}
            </p>
            <p className="text-xs capitalize text-slate-500">
              {user?.role} workspace
            </p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
}
