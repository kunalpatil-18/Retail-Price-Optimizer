import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  Package,
  Search,
  RefreshCw,
  Plus,
  ShieldCheck,
  Store,
  ArrowRight,
  Activity,
  AlertCircle,
  LayoutDashboard,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";

const API = "http://127.0.0.1:5000";

const headers = (token, json = false) => ({
  Authorization: `Bearer ${token}`,
  ...(json ? { "Content-Type": "application/json" } : {}),
});

const isActive = (retailer) =>
  retailer.active === true ||
  retailer.active === 1 ||
  retailer.active === "1";

const formatDate = (value) => {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function WorkspaceDashboard({ token, user, onNavigate }) {
  const isAdmin = user?.role === "admin";

  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);

  const loadRetailers = useCallback(
    async (isRefresh = false) => {
      if (!isAdmin) {
        setLoading(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const response = await fetch(`${API}/api/admin/retailers`, {
          headers: headers(token),
        });

        const data = await response.json().catch(() => []);

        if (!response.ok) {
          throw new Error(
            data.error || "Unable to load retailer accounts."
          );
        }

        if (!Array.isArray(data)) {
          throw new Error("Unexpected retailer data received from server.");
        }

        setRetailers(data);
      } catch (err) {
        setError(err.message || "Unable to load the admin dashboard.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, isAdmin]
  );

  useEffect(() => {
    loadRetailers();
  }, [loadRetailers]);

  const stats = useMemo(() => {
    const activeCount = retailers.filter(isActive).length;
    const inactiveCount = retailers.length - activeCount;

    const totalProducts = retailers.reduce(
      (total, retailer) => total + Number(retailer.product_count || 0),
      0
    );

    return {
      total: retailers.length,
      active: activeCount,
      inactive: inactiveCount,
      products: totalProducts,
    };
  }, [retailers]);

  const filteredRetailers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return retailers.filter((retailer) => {
      const matchesSearch =
        !query ||
        String(retailer.display_name || "")
          .toLowerCase()
          .includes(query) ||
        String(retailer.username || "")
          .toLowerCase()
          .includes(query);

      const active = isActive(retailer);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && active) ||
        (statusFilter === "inactive" && !active);

      return matchesSearch && matchesStatus;
    });
  }, [retailers, search, statusFilter]);

  async function toggleRetailer(retailer) {
    const currentlyActive = isActive(retailer);

    const confirmed = window.confirm(
      currentlyActive
        ? `Deactivate ${retailer.display_name || retailer.username}? They will lose access to the application.`
        : `Activate ${retailer.display_name || retailer.username}?`
    );

    if (!confirmed) return;

    setUpdatingId(retailer.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API}/api/admin/retailers/${retailer.id}`,
        {
          method: "PATCH",
          headers: headers(token, true),
          body: JSON.stringify({
            active: !currentlyActive,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to update retailer status.");
      }

      setMessage(
        `${retailer.display_name || retailer.username} account ${
          currentlyActive ? "deactivated" : "activated"
        } successfully.`
      );

      await loadRetailers(true);
    } catch (err) {
      setError(err.message || "Unable to update account status.");
    } finally {
      setUpdatingId(null);
    }
  }

  if (!isAdmin) {
    return (
      <RetailerOverview
        user={user}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      {/* Page heading */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600">
            <ShieldCheck size={15} />
            Platform administration
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Admin Overview
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Monitor retailer accounts, review account activity and manage
            access to the Retail Price Optimizer platform.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate("accounts")}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus size={18} />
          Create retailer
        </button>
      </header>

      {/* Feedback */}
      {message && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p>{message}</p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle size={18} className="mt-0.5 shrink-0" />

          <div className="min-w-0 flex-1">
            <p>{error}</p>

            <button
              type="button"
              onClick={() => loadRetailers(true)}
              className="mt-2 font-semibold underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Overview cards */}
      <section>
        <SectionHeading
          title="Platform overview"
          description="Account and product totals from your retailer directory."
          action={
            <button
              type="button"
              onClick={() => loadRetailers(true)}
              disabled={refreshing}
              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw
                size={14}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh
            </button>
          }
        />

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total retailers"
            value={stats.total}
            description="Registered retailer accounts"
            icon={Users}
            color="blue"
            loading={loading}
          />

          <StatCard
            title="Active accounts"
            value={stats.active}
            description="Accounts currently enabled"
            icon={UserCheck}
            color="green"
            loading={loading}
          />

          <StatCard
            title="Disabled accounts"
            value={stats.inactive}
            description="Accounts currently inactive"
            icon={UserX}
            color="amber"
            loading={loading}
          />

          <StatCard
            title="Products listed"
            value={stats.products}
            description="Products across retailer accounts"
            icon={Package}
            color="purple"
            loading={loading}
          />
        </div>
      </section>

      {/* Account health */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading
            title="Account health"
            description="Current status of retailer access."
          />

          {loading ? (
            <LoadingLine />
          ) : (
            <>
              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold tracking-tight text-slate-900">
                    {stats.total > 0
                      ? Math.round((stats.active / stats.total) * 100)
                      : 0}
                    %
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Active account rate
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-700">
                    {stats.active} active
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    of {stats.total} retailers
                  </p>
                </div>
              </div>

              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${
                      stats.total
                        ? (stats.active / stats.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Active: {stats.active}
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  Disabled: {stats.inactive}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-2">
          <SectionHeading
            title="Admin quick actions"
            description="Common tasks for platform administration."
          />

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QuickAction
              icon={Users}
              title="Manage retailer accounts"
              description="Create accounts and control access."
              onClick={() => onNavigate("accounts")}
            />

            <QuickAction
              icon={Package}
              title="Review product workspace"
              description="Open account management and product tools."
              onClick={() => onNavigate("accounts")}
            />
          </div>

          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="flex items-start gap-3">
              <Activity
                size={19}
                className="mt-0.5 shrink-0 text-blue-700"
              />

              <div>
                <p className="text-sm font-semibold text-blue-950">
                  Platform access control
                </p>

                <p className="mt-1 text-xs leading-5 text-blue-800">
                  Deactivating a retailer disables access and invalidates
                  their existing sessions. It does not delete their account
                  or product records.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Retailer directory */}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5 sm:p-6">
          <SectionHeading
            title="Retailer directory"
            description="Search retailer accounts, check product counts and manage access."
            action={
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                <Store size={13} />
                {filteredRetailers.length} shown
              </span>
            }
          />

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search
                size={17}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by retailer name or username..."
                className="block min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 sm:w-48"
            >
              <option value="all">All accounts</option>
              <option value="active">Active only</option>
              <option value="inactive">Disabled only</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-4 p-6">
            <LoadingLine />
            <LoadingLine />
            <LoadingLine />
          </div>
        ) : filteredRetailers.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Users size={23} />
            </div>

            <h3 className="mt-4 font-semibold text-slate-900">
              {retailers.length === 0
                ? "No retailer accounts yet"
                : "No matching retailers"}
            </h3>

            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {retailers.length === 0
                ? "Create a retailer account to get started."
                : "Try another search term or change the status filter."}
            </p>

            {retailers.length === 0 && (
              <button
                type="button"
                onClick={() => onNavigate("accounts")}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus size={16} />
                Create retailer
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Retailer</th>
                  <th className="px-5 py-3.5 font-semibold">Username</th>
                  <th className="px-5 py-3.5 text-right font-semibold">
                    Products
                  </th>
                  <th className="px-5 py-3.5 font-semibold">Created</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 text-right font-semibold">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredRetailers.map((retailer) => {
                  const active = isActive(retailer);
                  const updating = updatingId === retailer.id;

                  return (
                    <tr
                      key={retailer.id}
                      className="transition hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-700">
                            {String(
                              retailer.display_name ||
                                retailer.username ||
                                "R"
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">
                              {retailer.display_name || "Unnamed retailer"}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Account #{retailer.id}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {retailer.username}
                      </td>

                      <td className="px-5 py-4 text-right font-semibold text-slate-800">
                        {Number(retailer.product_count || 0).toLocaleString(
                          "en-IN"
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                        {formatDate(retailer.created_at)}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge active={active} />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => toggleRetailer(retailer)}
                          disabled={updating}
                          className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            active
                              ? "border-red-200 bg-white text-red-700 hover:bg-red-50"
                              : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {updating ? (
                            <RefreshCw size={13} className="animate-spin" />
                          ) : active ? (
                            <XCircle size={14} />
                          ) : (
                            <CheckCircle2 size={14} />
                          )}

                          {updating
                            ? "Updating"
                            : active
                              ? "Deactivate"
                              : "Activate"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-5 text-slate-500">
            Account counts reflect the directory returned by the backend.
          </p>

          <button
            type="button"
            onClick={() => onNavigate("accounts")}
            className="inline-flex items-center gap-2 self-start text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            Open account management
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      <p className="text-xs leading-5 text-slate-400">
        Platform summary is based on registered retailer accounts and their
        saved product counts. Retailer sales and profit are not aggregated
        into this dashboard.
      </p>
    </div>
  );
}

function RetailerOverview({ user, onNavigate }) {
  const shortcuts = [
    {
      id: "optimization",
      title: "Price Optimization",
      description: "Evaluate pricing scenarios for your products.",
      icon: Activity,
      color: "blue",
    },
    {
      id: "whatif",
      title: "What-If Analysis",
      description: "Compare a proposed price with your current price.",
      icon: LayoutDashboard,
      color: "purple",
    },
    {
      id: "inventory",
      title: "Inventory",
      description: "Review stock levels and product availability.",
      icon: Package,
      color: "amber",
    },
    {
      id: "analytics",
      title: "Retail Analytics",
      description: "Understand sales and revenue from your own data.",
      icon: Activity,
      color: "green",
    },
    {
      id: "accounts",
      title: "Products & Approvals",
      description: "Manage products, imports and recommendations.",
      icon: Store,
      color: "blue",
    },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
          Retailer workspace
        </p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Welcome, {user?.displayName || user?.username || "Retailer"}
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Manage your products, explore pricing scenarios and understand your
          shop's performance.
        </p>
      </header>

      <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <Store size={24} />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              Your shop workspace
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-600">
              Start by maintaining your product catalog and importing your
              own sales history. Analytics and optimization depend on the
              available records for your account.
            </p>

            <button
              type="button"
              onClick={() => onNavigate("accounts")}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Open products & approvals
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading
          title="Your workspace tools"
          description="Choose what you want to work on."
        />

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((item) => {
            const Icon = item.icon;

            const colors = {
              blue: "bg-blue-50 text-blue-700",
              purple: "bg-purple-50 text-purple-700",
              amber: "bg-amber-50 text-amber-700",
              green: "bg-emerald-50 text-emerald-700",
            };

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors[item.color]}`}
                  >
                    <Icon size={21} />
                  </div>

                  <ExternalLink
                    size={16}
                    className="text-slate-300 transition group-hover:text-blue-600"
                  />
                </div>

                <h3 className="mt-4 font-semibold text-slate-900">
                  {item.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {item.description}
                </p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ title, description, action }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>

        {description && (
          <p className="mt-1 text-sm leading-5 text-slate-500">
            {description}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  color,
  loading,
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    purple: "bg-purple-50 text-purple-700",
  };

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>

          {loading ? (
            <div className="mt-3 h-8 w-20 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <p className="mt-3 break-words text-3xl font-bold tracking-tight text-slate-900">
              {Number(value).toLocaleString("en-IN")}
            </p>
          )}

          <p className="mt-2 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colors[color]}`}
        >
          <Icon size={21} />
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-slate-400"
        }`}
      />

      {active ? "Active" : "Disabled"}
    </span>
  );
}

function QuickAction({ icon: Icon, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/50"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition group-hover:bg-blue-100 group-hover:text-blue-700">
        <Icon size={19} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{title}</p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>

      <ArrowRight
        size={16}
        className="shrink-0 text-slate-300 transition group-hover:text-blue-600"
      />
    </button>
  );
}

function LoadingLine() {
  return (
    <div className="h-4 w-full animate-pulse rounded-md bg-slate-100" />
  );
}