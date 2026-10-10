import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  IndianRupee,
  ShoppingCart,
  Package,
  ChartNoAxesCombined,
  CalendarDays,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  AlertCircle,
  Activity,
} from "lucide-react";

const API = "http://127.0.0.1:5000";

const CHART_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#059669",
  "#d97706",
  "#db2777",
];

const money = (value) =>
  `₹${Number(value ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const number = (value) =>
  Number(value ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });

const compactMoney = (value) =>
  `₹${Number(value ?? 0).toLocaleString("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
  })}`;

function safePercent(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }

  if (previous === 0) {
    return current > 0 ? null : 0;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

function getTrendLabel(current, previous) {
  const change = safePercent(current, previous);

  if (change === null) {
    return previous === 0 && current > 0
      ? "No previous-period baseline"
      : "Not available";
  }

  if (change === 0) return "No change vs previous month";

  return `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs previous month`;
}

function SectionHeading({ title, description, action }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
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

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  color = "blue",
}) {
  const styles = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    purple: "bg-purple-50 text-purple-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <p className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${styles[color]}`}
        >
          <Icon size={20} />
        </div>
      </div>
    </article>
  );
}

function ChartCard({ title, description, children }) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <SectionHeading title={title} description={description} />

      <div className="mt-5 h-72 min-w-0">{children}</div>
    </section>
  );
}

function EmptyChart({ message = "No data available for this chart." }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-5 text-center">
      <ChartNoAxesCombined size={27} className="text-slate-300" />

      <p className="mt-3 text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
}

function AnalyticsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="max-w-xs rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
      <p className="mb-2 text-xs font-semibold text-slate-500">{label}</p>

      {payload.map((item) => (
        <div
          key={item.dataKey}
          className="flex items-center justify-between gap-5 py-1 text-sm"
        >
          <span className="text-slate-600">{item.name || item.dataKey}</span>

          <strong className="text-slate-900">
            {item.dataKey?.toLowerCase().includes("revenue") ||
            item.dataKey?.toLowerCase().includes("profit")
              ? money(item.value)
              : number(item.value)}
          </strong>
        </div>
      ))}
    </div>
  );
}

export default function Analytics({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  async function loadAnalytics() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/api/analytics`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to load analytics.");
      }

      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || "Unable to load your shop analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, [token]);

  const monthly = useMemo(() => {
    return (data?.monthly || []).map((item) => ({
      ...item,
      revenue: Number(item.revenue ?? 0),
    }));
  }, [data]);

  const categories = useMemo(() => {
    return (data?.categories || []).map((item) => ({
      ...item,
      units: Number(item.units ?? 0),
    }));
  }, [data]);

  const topProducts = useMemo(() => {
    return [...(data?.topProducts || [])].sort(
      (a, b) => Number(b.revenue ?? 0) - Number(a.revenue ?? 0)
    );
  }, [data]);

  const totals = data?.totals || {
    records: 0,
    units: 0,
    revenue: 0,
    gross_profit: 0,
  };

  const monthlyInsights = useMemo(() => {
    if (monthly.length === 0) return null;

    const sorted = [...monthly];
    const latest = sorted[sorted.length - 1];
    const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

    const best = sorted.reduce((bestMonth, item) =>
      Number(item.revenue) > Number(bestMonth.revenue) ? item : bestMonth
    );

    return {
      latest,
      previous,
      best,
      change: previous
        ? safePercent(Number(latest.revenue), Number(previous.revenue))
        : null,
    };
  }, [monthly]);

  const categoryInsights = useMemo(() => {
    const totalUnits = categories.reduce(
      (sum, item) => sum + Number(item.units ?? 0),
      0
    );

    const sorted = [...categories].sort(
      (a, b) => Number(b.units) - Number(a.units)
    );

    return {
      totalUnits,
      sorted,
      leading: sorted[0] || null,
      share:
        totalUnits > 0 && sorted[0]
          ? (Number(sorted[0].units) / totalUnits) * 100
          : 0,
    };
  }, [categories]);

  const productInsights = useMemo(() => {
    const revenueTotal = topProducts.reduce(
      (sum, item) => sum + Number(item.revenue ?? 0),
      0
    );

    const leader = topProducts[0] || null;

    return {
      leader,
      revenueTotal,
      leaderShare:
        revenueTotal > 0 && leader
          ? (Number(leader.revenue) / revenueTotal) * 100
          : 0,
    };
  }, [topProducts]);

  if (loading && !data) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <RefreshCw size={19} className="animate-spin" />
          Loading your shop analytics...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={21}
              className="mt-0.5 shrink-0 text-red-600"
            />

            <div>
              <h2 className="font-semibold text-red-900">
                Analytics could not be loaded
              </h2>

              <p className="mt-1 text-sm leading-6 text-red-700">{error}</p>

              <button
                type="button"
                onClick={loadAnalytics}
                className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
              >
                <RefreshCw size={15} />
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.hasSalesData) {
    return (
      <div className="space-y-6">
        <PageHeader
          onRefresh={loadAnalytics}
          loading={loading}
          lastUpdated={lastUpdated}
        />

        <section className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <ChartNoAxesCombined size={24} />
          </div>

          <h2 className="mt-5 text-xl font-bold text-slate-900">
            Your analytics workspace is ready
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Import your shop's sales CSV from Products &amp; Data Import to
            unlock sales trends, revenue summaries, category performance and
            top-product analysis.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Sales overview", "Track records, units and revenue."],
              ["Monthly trends", "See how revenue changes over time."],
              ["Category analysis", "Compare units sold across categories."],
              ["Top products", "Identify products generating the most revenue."],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <h3 className="text-sm font-semibold text-slate-800">
                  {title}
                </h3>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {description}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-5 text-xs leading-5 text-slate-500">
            No sample sales data is displayed. Charts will use the data
            returned for your authenticated retailer account.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        onRefresh={loadAnalytics}
        loading={loading}
        lastUpdated={lastUpdated}
      />

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          Refresh failed: {error}. Showing the last successfully loaded data.
        </div>
      )}

      {/* KPI overview */}
      <section>
        <SectionHeading
          title="Business overview"
          description="A snapshot of your imported sales records and estimated performance."
        />

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Sales records"
            value={number(totals.records)}
            description="Imported transaction rows"
            icon={Activity}
            color="blue"
          />

          <KpiCard
            title="Units sold"
            value={number(totals.units)}
            description="Total recorded quantity"
            icon={ShoppingCart}
            color="purple"
          />

          <KpiCard
            title="Sales revenue"
            value={money(totals.revenue)}
            description="Revenue from imported sales"
            icon={IndianRupee}
            color="green"
          />

          <KpiCard
            title="Gross profit estimate"
            value={money(totals.gross_profit)}
            description="Uses current saved product costs"
            icon={TrendingUp}
            color="amber"
          />
        </div>
      </section>

      {/* Monthly revenue trend */}
      <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ChartCard
            title="Monthly sales revenue"
            description="Revenue trend from your imported sales history."
          >
            {monthly.length === 0 ? (
              <EmptyChart message="No monthly revenue data available." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthly}
                  margin={{ top: 10, right: 8, left: 8, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="analyticsRevenueGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#2563eb"
                        stopOpacity={0.22}
                      />

                      <stop
                        offset="95%"
                        stopColor="#2563eb"
                        stopOpacity={0.01}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="#e2e8f0"
                    strokeDasharray="4 4"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    minTickGap={16}
                  />

                  <YAxis
                    tickFormatter={compactMoney}
                    tickLine={false}
                    axisLine={false}
                    width={65}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                  />

                  <Tooltip content={<AnalyticsTooltip />} />

                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    fill="url(#analyticsRevenueGradient)"
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading
            title="Monthly highlights"
            description="Insights from the available monthly revenue series."
          />

          {monthlyInsights ? (
            <div className="mt-5 space-y-4">
              <InsightRow
                icon={CalendarDays}
                label="Latest available period"
                value={monthlyInsights.latest.period || "—"}
              />

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">
                  Latest period revenue
                </p>

                <p className="mt-2 text-xl font-bold text-slate-900">
                  {money(monthlyInsights.latest.revenue)}
                </p>

                {monthlyInsights.previous && (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {getTrendLabel(
                      Number(monthlyInsights.latest.revenue),
                      Number(monthlyInsights.previous.revenue)
                    )}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                <p className="text-sm text-emerald-800">
                  Highest revenue in displayed periods
                </p>

                <p className="mt-2 font-bold text-emerald-950">
                  {money(monthlyInsights.best.revenue)}
                </p>

                <p className="mt-1 text-xs text-emerald-800">
                  {monthlyInsights.best.period || "Period not specified"}
                </p>
              </div>

              <p className="text-xs leading-5 text-slate-400">
                Highlights cover the periods returned by the analytics API;
                they do not imply a complete historical date range.
              </p>
            </div>
          ) : (
            <div className="mt-5">
              <EmptyChart message="Monthly highlights need monthly revenue data." />
            </div>
          )}
        </section>
      </section>

      {/* Category and product analysis */}
      <section className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartCard
          title="Units sold by category"
          description="Compare recorded sales quantities across product categories."
        >
          {categories.length === 0 ? (
            <EmptyChart message="No category data available." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryInsights.sorted}
                margin={{ top: 10, right: 8, left: 8, bottom: 5 }}
              >
                <CartesianGrid
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                  vertical={false}
                />

                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  interval={0}
                />

                <YAxis
                  tickFormatter={number}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                />

                <Tooltip content={<AnalyticsTooltip />} />

                <Bar
                  dataKey="units"
                  name="Units sold"
                  fill="#7c3aed"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={54}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <SectionHeading
            title="Category breakdown"
            description="Share of recorded units sold by category."
          />

          {categories.length === 0 || categoryInsights.totalUnits === 0 ? (
            <div className="mt-5 h-64">
              <EmptyChart message="Category share is unavailable." />
            </div>
          ) : (
            <>
              <div className="mt-3 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryInsights.sorted}
                      dataKey="units"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={94}
                      paddingAngle={3}
                    >
                      {categoryInsights.sorted.map((item, index) => (
                        <Cell
                          key={item.name}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>

                    <Tooltip content={<AnalyticsTooltip />} />

                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      wrapperStyle={{ fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 space-y-3">
                {categoryInsights.sorted.map((item, index) => {
                  const share =
                    (Number(item.units) / categoryInsights.totalUnits) * 100;

                  return (
                    <div key={item.name}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                        <span className="flex min-w-0 items-center gap-2 text-slate-600">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                CHART_COLORS[index % CHART_COLORS.length],
                            }}
                          />

                          <span className="truncate">{item.name}</span>
                        </span>

                        <span className="shrink-0 font-semibold text-slate-900">
                          {share.toFixed(1)}%
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${share}%`,
                            backgroundColor:
                              CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </section>

      {/* Top products */}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <SectionHeading
            title="Top products by revenue"
            description="Products ranked by revenue in the API's returned product summary."
          />
        </div>

        {topProducts.length === 0 ? (
          <div className="p-6">
            <EmptyChart message="No product revenue data available." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Rank</th>
                  <th className="px-5 py-3 font-semibold">SKU</th>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Units
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Avg. sale price
                  </th>
                  <th className="px-5 py-3 text-right font-semibold">
                    Revenue
                  </th>
                  <th className="px-5 py-3 font-semibold">Revenue share</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {topProducts.map((item, index) => {
                  const revenueShare =
                    Number(totals.revenue) > 0
                      ? (Number(item.revenue ?? 0) /
                          Number(totals.revenue)) *
                        100
                      : 0;

                  return (
                    <tr
                      key={item.sku || `${item.name}-${index}`}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                            index === 0
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {index + 1}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-slate-500">
                        {item.sku || "—"}
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-900">
                        {item.name || "Unnamed product"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right text-slate-600">
                        {number(item.units)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right text-slate-600">
                        {money(item.averagePrice)}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-slate-900">
                        {money(item.revenue)}
                      </td>

                      <td className="min-w-36 px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(0, revenueShare)
                                )}%`,
                              }}
                            />
                          </div>

                          <span className="w-12 text-right text-xs text-slate-500">
                            {revenueShare.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Business interpretation */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
            <Lightbulb size={20} />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              Business takeaways
            </h2>

            <p className="mt-1 text-sm leading-5 text-slate-500">
              Data-backed observations to help you decide what to investigate
              next.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Takeaway
            title="Revenue leader"
            text={
              productInsights.leader
                ? `${productInsights.leader.name} is the top product by returned revenue, at ${money(productInsights.leader.revenue)}.`
                : "Product revenue data is not available yet."
            }
          />

          <Takeaway
            title="Category leader"
            text={
              categoryInsights.leading
                ? `${categoryInsights.leading.name} accounts for ${categoryInsights.share.toFixed(1)}% of recorded units sold.`
                : "Category-level unit data is not available yet."
            }
          />

          <Takeaway
            title="Monthly performance"
            text={
              monthlyInsights
                ? `The highest revenue among displayed months was ${money(monthlyInsights.best.revenue)} in ${monthlyInsights.best.period || "an unspecified period"}.`
                : "Monthly revenue data is not available yet."
            }
          />
        </div>
      </section>

      {/* Data quality note */}
      <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0 text-amber-700"
          />

          <div>
            <h3 className="text-sm font-semibold text-amber-900">
              How to read these metrics
            </h3>

            <p className="mt-1 text-xs leading-5 text-amber-800">
              Gross profit is an estimate using current saved product costs,
              not historical cost at the time of sale. Revenue shares in the
              product table use total revenue as the denominator, so they may
              not add up to 100% if the table contains only a subset of
              products. Monthly comparisons use the periods returned by your
              backend and do not independently verify missing months.
            </p>
          </div>
        </div>
      </section>

      <p className="text-xs text-slate-400">
        {lastUpdated
          ? `Last refreshed at ${lastUpdated.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "Analytics data is loaded from your retailer account."}
      </p>
    </div>
  );
}

function PageHeader({ onRefresh, loading, lastUpdated }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
          Business intelligence
        </p>

        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          Retail Analytics
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Understand your shop's recorded sales, revenue trends, category
          performance and leading products.
        </p>

        {lastUpdated && (
          <p className="mt-2 text-xs text-slate-400">
            Last updated{" "}
            {lastUpdated.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        Refresh analytics
      </button>
    </header>
  );
}

function InsightRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
        <Icon size={17} />
      </div>

      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-slate-900">
          {value}
        </p>
      </div>
    </div>
  );
}

function Takeaway({ title, text }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </article>
  );
}