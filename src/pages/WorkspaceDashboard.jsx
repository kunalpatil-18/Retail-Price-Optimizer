
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FlaskConical,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  TrendingUp,
  Upload,
  Wallet,
  XCircle,
} from "lucide-react";

const API = "http://127.0.0.1:5000";

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const number = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 0,
  });

const getName = (p) => p.name || p.product_name || "Unnamed product";
const getSku = (p) => p.sku || p.SKU || "—";
const getPrice = (p) =>
  Number(p.currentPrice ?? p.current_price ?? p.price ?? 0);
const getCost = (p) => Number(p.unitCost ?? p.unit_cost ?? p.cost ?? 0);
const getStock = (p) =>
  Number(p.inventory ?? p.stock ?? p.quantity_in_stock ?? 0);

async function fetchJson(url, token) {
  const response = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accent = "blue",
  onClick,
}) {
  const accents = {
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${accents[accent]}`}
        >
          <Icon size={21} />
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">{subtitle}</span>
        <ArrowRight
          size={15}
          className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-600"
        />
      </div>
    </button>
  );
}

function SectionTitle({ title, description, action }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function ActionCard({ icon: Icon, title, description, onClick, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-200 hover:shadow-md sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`flex h-11 w-11 items-center justify-center rounded-xl ${
            colors[color] || colors.blue
          }`}
        >
          <Icon size={21} />
        </span>
        <ArrowUpRight
          size={18}
          className="text-slate-400 group-hover:text-blue-600"
        />
      </div>
      <h3 className="mt-4 font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
    </button>
  );
}

export default function WorkspaceDashboard({ token, user, onNavigate }) {
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const [productData, salesData, recommendationData] =
        await Promise.all([
          fetchJson("/api/products", token),
          fetchJson("/api/sales/summary", token),
          fetchJson("/api/recommendations", token),
        ]);

      setProducts(Array.isArray(productData) ? productData : []);
      setSummary(
        salesData && typeof salesData === "object" ? salesData : {}
      );
      setRecommendations(
        Array.isArray(recommendationData) ? recommendationData : []
      );
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err.message ||
          "Dashboard data could not be loaded. Check that the backend is running."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const units = Number(summary.units ?? summary.total_units ?? 0);
    const revenue = Number(summary.revenue ?? summary.total_revenue ?? 0);
    const salesRows = Number(
      summary.records ?? summary.sales_rows ?? summary.total_records ?? 0
    );

    const inventoryUnits = products.reduce(
      (total, product) => total + Math.max(0, getStock(product)),
      0
    );

    const inventoryCostValue = products.reduce(
      (total, product) =>
        total + Math.max(0, getStock(product)) * Math.max(0, getCost(product)),
      0
    );

    const inventoryRetailValue = products.reduce(
      (total, product) =>
        total + Math.max(0, getStock(product)) * Math.max(0, getPrice(product)),
      0
    );

    const lowStock = products.filter((product) => {
      const stock = getStock(product);
      return stock > 0 && stock <= 5;
    });

    const outOfStock = products.filter((product) => getStock(product) <= 0);

    const pending = recommendations.filter(
      (item) => String(item.status || "").toLowerCase() === "pending"
    );

    const approved = recommendations.filter(
      (item) => String(item.status || "").toLowerCase() === "approved"
    );

    const rejected = recommendations.filter(
      (item) => String(item.status || "").toLowerCase() === "rejected"
    );

    const potentialMargin = products.reduce(
      (total, product) =>
        total +
        Math.max(0, getPrice(product) - getCost(product)) *
          Math.max(0, getStock(product)),
      0
    );

    return {
      units,
      revenue,
      salesRows,
      inventoryUnits,
      inventoryCostValue,
      inventoryRetailValue,
      lowStock,
      outOfStock,
      pending,
      approved,
      rejected,
      potentialMargin,
    };
  }, [products, summary, recommendations]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const sorted = [...products].sort(
      (a, b) => getStock(a) - getStock(b)
    );

    if (!term) return sorted;

    return sorted.filter((product) =>
      `${getName(product)} ${getSku(product)} ${product.category || ""}`
        .toLowerCase()
        .includes(term)
    );
  }, [products, search]);

  const checklist = [
    {
      title: "Add your product catalog",
      description: "Add products with selling price, cost and stock.",
      complete: products.length > 0,
      action: () => onNavigate("accounts"),
      button: "Manage products",
    },
    {
      title: "Import your sales history",
      description: "Bring in dated transactions linked to your product SKUs.",
      complete: stats.salesRows > 0,
      action: () => onNavigate("accounts"),
      button: "Import sales",
    },
    {
      title: "Review price recommendations",
      description: "Run the optimizer and review proposed price changes.",
      complete: recommendations.length > 0,
      action: () => onNavigate("optimization"),
      button: "Open optimizer",
    },
  ];

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="h-36 animate-pulse rounded-3xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-2xl bg-slate-200"
            />
          ))}
        </div>
        <p className="text-center text-sm text-slate-500">
          Loading your shop data…
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7 pb-10">
      {/* Welcome banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-16 h-64 w-64 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-2 -top-8 h-48 w-48 rounded-full border border-white/10" />

        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
              <Sparkles size={14} />
              YOUR RETAIL BUSINESS WORKSPACE
            </div>

            <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome back, {user?.displayName || user?.display_name || user?.username || "Retailer"}
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
              Manage your products, monitor stock and make informed pricing
              decisions—all from one place.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => onNavigate("optimization")}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-blue-900 transition hover:bg-blue-50"
              >
                <Tag size={17} />
                Optimize prices
                <ArrowRight size={16} />
              </button>

              <button
                onClick={() => onNavigate("accounts")}
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <Upload size={17} />
                Manage shop data
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
            <p className="text-xs text-blue-100">Workspace status</p>
            <div className="mt-2 flex items-center gap-2 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Account connected
            </div>
            <p className="mt-2 text-xs text-blue-100">
              {lastUpdated
                ? `Updated ${lastUpdated.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : "Waiting for data"}
            </p>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-blue-100 disabled:opacity-60"
            >
              <RefreshCw
                size={15}
                className={refreshing ? "animate-spin" : ""}
              />
              Refresh data
            </button>
          </div>
        </div>
      </section>

      {error && (
        <section
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"
        >
          <XCircle size={20} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Could not refresh shop data</p>
            <p className="mt-1 text-sm">{error}</p>
          </div>
          <button
            onClick={() => load()}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold"
          >
            Try again
          </button>
        </section>
      )}

      {/* Business metrics */}
      <section>
        <SectionTitle
          title="Business at a glance"
          description="Summary based on your saved catalog and imported sales records."
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="My products"
            value={number(products.length)}
            subtitle="Products in your catalog"
            icon={ShoppingBag}
            accent="blue"
            onClick={() => onNavigate("accounts")}
          />

          <MetricCard
            title="Sales revenue"
            value={money(stats.revenue)}
            subtitle={
              stats.salesRows
                ? `${number(stats.salesRows)} imported sales rows`
                : "Import sales to calculate revenue"
            }
            icon={Wallet}
            accent="green"
            onClick={() => onNavigate("analytics")}
          />

          <MetricCard
            title="Units sold"
            value={number(stats.units)}
            subtitle={
              stats.salesRows
                ? "Units recorded in sales history"
                : "No sales history recorded"
            }
            icon={TrendingUp}
            accent="violet"
            onClick={() => onNavigate("analytics")}
          />

          <MetricCard
            title="Awaiting review"
            value={number(stats.pending.length)}
            subtitle="Price recommendations pending"
            icon={Clock3}
            accent="amber"
            onClick={() => onNavigate("optimization")}
          />
        </div>
      </section>

      {/* Inventory alerts */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <SectionTitle
          title="Inventory health"
          description="Use these indicators to decide which stock needs attention."
          action={
            <button
              onClick={() => onNavigate("inventory")}
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700"
            >
              View inventory <ArrowRight size={15} />
            </button>
          }
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Units in stock</p>
            <p className="mt-2 text-2xl font-bold">{number(stats.inventoryUnits)}</p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Stock cost value</p>
            <p className="mt-2 text-2xl font-bold">
              {money(stats.inventoryCostValue)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Stock retail value</p>
            <p className="mt-2 text-2xl font-bold">
              {money(stats.inventoryRetailValue)}
            </p>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">Low / zero stock</p>
            <p className="mt-2 text-2xl font-bold text-amber-950">
              {number(stats.lowStock.length + stats.outOfStock.length)}
            </p>
            <p className="mt-1 text-xs text-amber-800">
              {number(stats.lowStock.length)} low · {number(stats.outOfStock.length)} out
            </p>
          </div>
        </div>

        {(stats.lowStock.length > 0 || stats.outOfStock.length > 0) && (
          <div className="mt-5 space-y-2">
            {stats.outOfStock.slice(0, 3).map((product) => (
              <div
                key={product.id || getSku(product)}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-red-100 bg-red-50/70 p-3"
              >
                <XCircle size={18} className="text-red-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {getName(product)}
                  </p>
                  <p className="text-xs text-slate-500">
                    SKU: {getSku(product)}
                  </p>
                </div>
                <span className="text-xs font-bold text-red-700">
                  Out of stock
                </span>
              </div>
            ))}

            {stats.lowStock.slice(0, 3).map((product) => (
              <div
                key={product.id || getSku(product)}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/70 p-3"
              >
                <AlertTriangle size={18} className="text-amber-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {getName(product)}
                  </p>
                  <p className="text-xs text-slate-500">
                    SKU: {getSku(product)}
                  </p>
                </div>
                <span className="text-xs font-bold text-amber-800">
                  {number(getStock(product))} left
                </span>
              </div>
            ))}
          </div>
        )}

        {products.length > 0 &&
          stats.lowStock.length === 0 &&
          stats.outOfStock.length === 0 && (
            <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 size={18} />
              No products are currently below the dashboard's low-stock threshold of 5 units.
            </div>
          )}
      </section>

      {/* Quick actions */}
      <section>
        <SectionTitle
          title="Quick actions"
          description="Jump straight to the task you need."
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ActionCard
            icon={Package}
            title="Products & imports"
            description="Add products or upload product and sales CSV files."
            color="blue"
            onClick={() => onNavigate("accounts")}
          />

          <ActionCard
            icon={Tag}
            title="Price optimization"
            description="Generate proposed selling prices and review decisions."
            color="green"
            onClick={() => onNavigate("optimization")}
          />

          <ActionCard
            icon={FlaskConical}
            title="What-If analysis"
            description="Explore possible outcomes for alternative prices."
            color="violet"
            onClick={() => onNavigate("whatif")}
          />

          <ActionCard
            icon={BarChart3}
            title="Sales analytics"
            description="Review the sales metrics available from your records."
            color="amber"
            onClick={() => onNavigate("analytics")}
          />
        </div>
      </section>

      {/* Onboarding */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <SectionTitle
          title="Your setup checklist"
          description="Complete these steps to get more value from the workspace."
        />

        <div className="mt-5 space-y-3">
          {checklist.map((item, index) => (
            <div
              key={item.title}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-4"
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  item.complete
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {item.complete ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <span className="font-bold">{index + 1}</span>
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.description}
                </p>
              </div>

              <button
                onClick={item.action}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
              >
                {item.complete ? "Open" : item.button}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Recommendation center */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <SectionTitle
          title="Price decision center"
          description="Review recent recommendations before applying any price change."
          action={
            <button
              onClick={() => onNavigate("optimization")}
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700"
            >
              Open optimizer <ArrowRight size={15} />
            </button>
          }
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-amber-50 p-4">
            <Clock3 className="text-amber-700" size={20} />
            <p className="mt-3 text-sm text-amber-800">Pending</p>
            <p className="mt-1 text-2xl font-bold text-amber-950">
              {number(stats.pending.length)}
            </p>
          </div>

          <div className="rounded-xl bg-emerald-50 p-4">
            <CheckCircle2 className="text-emerald-700" size={20} />
            <p className="mt-3 text-sm text-emerald-800">Approved</p>
            <p className="mt-1 text-2xl font-bold text-emerald-950">
              {number(stats.approved.length)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-100 p-4">
            <XCircle className="text-slate-600" size={20} />
            <p className="mt-3 text-sm text-slate-600">Rejected</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {number(stats.rejected.length)}
            </p>
          </div>
        </div>

        {recommendations.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center">
            <Tag className="mx-auto text-slate-400" size={28} />
            <p className="mt-3 font-semibold text-slate-800">
              No price recommendations yet
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Add products first, then open Price Optimization to generate a proposal.
            </p>
            <button
              onClick={() =>
                onNavigate(products.length ? "optimization" : "accounts")
              }
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              {products.length ? "Start optimization" : "Add products"}
            </button>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {recommendations.slice(0, 6).map((item, index) => {
              const current = Number(
                item.current_price ?? item.currentPrice ?? 0
              );
              const proposed = Number(
                item.recommended_price ?? item.recommendedPrice ?? 0
              );
              const delta = current ? ((proposed - current) / current) * 100 : 0;
              const status = String(item.status || "unknown").toLowerCase();

              return (
                <div
                  key={item.id ?? index}
                  className="flex flex-wrap items-center gap-3 py-4"
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      delta > 0
                        ? "bg-emerald-50 text-emerald-700"
                        : delta < 0
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {delta > 0 ? (
                      <ArrowUpRight size={20} />
                    ) : delta < 0 ? (
                      <ArrowDownRight size={20} />
                    ) : (
                      <Activity size={20} />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">
                      {item.product_name || item.productName || "Product recommendation"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {money(current)} → {money(proposed)}
                      {current > 0 && (
                        <span
                          className={`ml-2 font-semibold ${
                            delta > 0 ? "text-emerald-700" : delta < 0 ? "text-amber-700" : "text-slate-500"
                          }`}
                        >
                          {delta > 0 ? "+" : ""}
                          {delta.toFixed(1)}%
                        </span>
                      )}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      status === "approved"
                        ? "bg-emerald-50 text-emerald-700"
                        : status === "rejected"
                        ? "bg-red-50 text-red-700"
                        : status === "pending"
                        ? "bg-amber-50 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-4 text-xs leading-5 text-slate-500">
          Recommendations are estimates, not guaranteed outcomes. Confirm
          cost, stock and applicable margin limits before approving a price.
        </p>
      </section>

      {/* Product finder */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <SectionTitle
          title="Product finder"
          description="Quickly search your catalog and identify stock that may need attention."
          action={
            <button
              onClick={() => onNavigate("accounts")}
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700"
            >
              Manage catalog <ArrowRight size={15} />
            </button>
          }
        />

        <div className="relative mt-4">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by product name, SKU or category…"
            className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {filteredProducts.length === 0 ? (
          <div className="py-8 text-center">
            <Package className="mx-auto text-slate-400" size={28} />
            <p className="mt-2 font-semibold text-slate-800">
              {products.length ? "No matching products" : "Your catalog is empty"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {products.length
                ? "Try another search term."
                : "Add products or import your catalog to get started."}
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-3 pr-4">Product</th>
                  <th className="py-3 pr-4">Category</th>
                  <th className="py-3 pr-4">Price</th>
                  <th className="py-3 pr-4">Stock</th>
                  <th className="py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.slice(0, 8).map((product, index) => {
                  const stock = getStock(product);
                  const status =
                    stock <= 0
                      ? "Out of stock"
                      : stock <= 5
                      ? "Low stock"
                      : "In stock";

                  return (
                    <tr
                      key={product.id || getSku(product) || index}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900">
                          {getName(product)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {getSku(product)}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {product.category || "—"}
                      </td>
                      <td className="py-3 pr-4 font-semibold">
                        {money(getPrice(product))}
                      </td>
                      <td className="py-3 pr-4">{number(stock)}</td>
                      <td className="py-3">
                        <span
                          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${
                            stock <= 0
                              ? "bg-red-50 text-red-700"
                              : stock <= 5
                              ? "bg-amber-50 text-amber-800"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredProducts.length > 8 && (
              <p className="mt-3 text-xs text-slate-500">
                Showing 8 of {filteredProducts.length} matching products.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Data transparency */}
      <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
        <div className="flex items-start gap-3">
          <Database size={21} className="mt-0.5 shrink-0 text-blue-700" />
          <div>
            <h2 className="font-bold text-slate-900">About your numbers</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Sales revenue and units sold come from the sales summary API.
              Stock values are calculated from your saved inventory and product
              prices. Inventory retail value is not profit, and the difference
              between selling price and cost does not include operating expenses,
              taxes or other costs.
            </p>
            {!stats.salesRows && (
              <p className="mt-2 text-sm font-medium text-blue-800">
                Your sales summary is empty. Import your own sales history to
                populate sales-based metrics.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
