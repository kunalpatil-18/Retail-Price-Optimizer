
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Package, Upload, CheckCircle2, XCircle, RefreshCw, Plus,
  Search, FileSpreadsheet, Boxes, ClipboardCheck, AlertCircle,
  Download, TrendingUp, IndianRupee, Sparkles, ArrowUpRight,
  Layers3, CircleCheck, Clock3, FileUp
} from "lucide-react";

const API = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:5000"
).replace(/\/$/, "");

const authHeaders = (token, json = false) => ({
  Authorization: `Bearer ${token}`,
  ...(json ? { "Content-Type": "application/json" } : {}),
});

const money = (value) =>
  `₹${Number(value ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const initialProduct = {
  sku: "",
  name: "",
  category: "",
  current_price: "",
  unit_cost: "",
  inventory: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

export default function AccountWorkspace({ token, user }) {
  const isAdmin = user?.role === "admin";

  const [tab, setTab] = useState("products");
  const [products, setProducts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [decisionId, setDecisionId] = useState(null);
  const [product, setProduct] = useState(initialProduct);
  const [productFile, setProductFile] = useState(null);
  const [salesFile, setSalesFile] = useState(null);
  const [productPreview, setProductPreview] = useState([]);
  const [salesPreview, setSalesPreview] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const urls = [
        `${API}/api/products`,
        `${API}/api/recommendations`,
      ];

      const responses = await Promise.all(
        urls.map((url) =>
          fetch(url, { headers: authHeaders(token) })
        )
      );

      const data = await Promise.all(
        responses.map(async (response) => {
          const body = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(body.error || `API error: ${response.status}`);
          }
          return body;
        })
      );

      setProducts(
        Array.isArray(data[0]) ? data[0] : data[0].products || []
      );
      setRecommendations(
        Array.isArray(data[1])
          ? data[1]
          : data[1].recommendations || []
      );
    } catch (err) {
      setError(
        `${err.message}. Check that the backend is running at ${API}.`
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;

    return products.filter((item) =>
      [item.name, item.sku, item.category].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      )
    );
  }, [products, search]);

  const pending = recommendations.filter(
    (item) => String(item.status || "pending").toLowerCase() === "pending"
  );

  const inventoryUnits = products.reduce(
    (sum, item) => sum + Number(item.inventory ?? item.stock ?? 0),
    0
  );

  async function addProduct(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API}/api/products`, {
        method: "POST",
        headers: authHeaders(token, true),
        body: JSON.stringify({
          ...product,
          sku: product.sku.trim(),
          name: product.name.trim(),
          category: product.category.trim(),
          current_price: Number(product.current_price),
          unit_cost: Number(product.unit_cost),
          inventory: Number(product.inventory),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to add product.");

      setProduct(initialProduct);
      setMessage(data.message || "Product added successfully.");
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function inspectFile(file, kind) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a CSV file.");
      return;
    }

    setError("");
    setMessage("");

    const reader = new FileReader();

    reader.onload = () => {
      const rows = String(reader.result || "")
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .slice(0, 6)
        .map((line) => line.split(",").map((cell) => cell.trim()));

      if (kind === "products") {
        setProductFile(file);
        setProductPreview(rows);
      } else {
        setSalesFile(file);
        setSalesPreview(rows);
      }
    };

    reader.onerror = () => setError("Unable to read the CSV file.");
    reader.readAsText(file);
  }

  async function importFile(kind) {
    const file = kind === "products" ? productFile : salesFile;

    if (!file) {
      setError("Please select a CSV file first.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const endpoint =
        kind === "products" ? "/api/products/import" : "/api/sales/import";

      const response = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: authHeaders(token),
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "CSV import failed.");

      setMessage(data.message || "CSV imported successfully.");

      if (kind === "products") {
        setProductFile(null);
        setProductPreview([]);
      } else {
        setSalesFile(null);
        setSalesPreview([]);
      }

      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function decide(item, decision) {
    setDecisionId(item.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API}/api/recommendations/${item.id}/decision`,
        {
          method: "POST",
          headers: authHeaders(token, true),
          body: JSON.stringify({ decision }),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to save decision.");

      setMessage(data.message || `Recommendation ${decision}.`);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setDecisionId(null);
    }
  }

  function downloadTemplate(kind) {
    const content =
      kind === "products"
        ? "sku,name,category,current_price,unit_cost,inventory\nSKU001,Sample Product,General,100,60,25\n"
        : "date,sku,quantity,unit_price\n2026-01-15,SKU001,2,100\n";

    const url = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = `${kind}-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-w-0 space-y-7 pb-8 text-slate-800">
      {/* Page heading */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-6 text-white shadow-lg shadow-indigo-100 sm:p-8">
        <div className="pointer-events-none absolute -right-8 -top-16 h-64 w-64 rounded-full border-[35px] border-white/10" />
        <div className="pointer-events-none absolute -bottom-24 right-36 h-48 w-48 rounded-full bg-violet-400/20 blur-2xl" />

        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-indigo-50">
              <Sparkles size={14} />
              Retail Price Optimizer
            </div>

            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {isAdmin ? "Account Management" : "Products & Data Import"}
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">
              Manage your product catalog, track inventory and review
              smarter pricing recommendations from one workspace.
            </p>

            <p className="mt-4 text-sm text-indigo-100">
              Welcome back, <span className="font-semibold text-white">{user?.name || user?.username || "User"}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh data
          </button>
        </div>
      </header>

      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 shrink-0" size={19} />
          <div className="min-w-0">
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-1 break-words">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError("")}
            className="ml-auto text-red-500 hover:text-red-700"
            aria-label="Dismiss error"
          >
            <XCircle size={18} />
          </button>
        </div>
      )}

      {message && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CircleCheck size={19} className="shrink-0" />
          <span>{message}</span>
          <button
            type="button"
            onClick={() => setMessage("")}
            className="ml-auto"
            aria-label="Dismiss message"
          >
            <XCircle size={17} />
          </button>
        </div>
      )}

      {/* Stat cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total products"
          value={loading ? "…" : products.length}
          caption="Products in your catalog"
          icon={Package}
          tone="indigo"
        />
        <StatCard
          title="Inventory units"
          value={loading ? "…" : inventoryUnits.toLocaleString("en-IN")}
          caption="Units currently in stock"
          icon={Boxes}
          tone="blue"
        />
        <StatCard
          title="Pending approvals"
          value={loading ? "…" : pending.length}
          caption="Recommendations to review"
          icon={ClipboardCheck}
          tone="amber"
        />
        <StatCard
          title="Price recommendations"
          value={loading ? "…" : recommendations.length}
          caption="Total recommendations"
          icon={TrendingUp}
          tone="emerald"
        />
      </section>

      {/* Navigation tabs */}
      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <NavTab active={tab === "products"} onClick={() => setTab("products")} icon={Package}>
          Product catalog
        </NavTab>

        {!isAdmin && (
          <NavTab active={tab === "imports"} onClick={() => setTab("imports")} icon={FileSpreadsheet}>
            Data imports
          </NavTab>
        )}

        {!isAdmin && (
          <NavTab active={tab === "approvals"} onClick={() => setTab("approvals")} icon={ClipboardCheck}>
            Price approvals
            {pending.length > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                {pending.length}
              </span>
            )}
          </NavTab>
        )}
      </nav>

      {/* Product catalog */}
      {tab === "products" && (
        <section className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-3">
          {!isAdmin && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <SectionHeading
                icon={Plus}
                title="Add new product"
                subtitle="Enter product details to expand your catalog."
              />

              <form onSubmit={addProduct} className="mt-6 space-y-4">
                {[
                  ["sku", "SKU / Product code", "e.g. SKU001"],
                  ["name", "Product name", "Enter product name"],
                  ["category", "Category", "e.g. Electronics"],
                  ["current_price", "Selling price (₹)", "0.00"],
                  ["unit_cost", "Unit cost (₹)", "0.00"],
                  ["inventory", "Stock quantity", "0"],
                ].map(([key, label, placeholder]) => {
                  const numeric = ["current_price", "unit_cost", "inventory"].includes(key);
                  return (
                    <label key={key} className="block">
                      <span className="mb-2 block text-xs font-semibold text-slate-600">
                        {label}
                      </span>
                      <input
                        className={inputClass}
                        placeholder={placeholder}
                        required
                        type={numeric ? "number" : "text"}
                        min={numeric ? "0" : undefined}
                        step={
                          ["current_price", "unit_cost"].includes(key)
                            ? "0.01"
                            : key === "inventory"
                              ? "1"
                              : undefined
                        }
                        value={product[key]}
                        onChange={(event) =>
                          setProduct({ ...product, [key]: event.target.value })
                        }
                      />
                    </label>
                  );
                })}

                <button disabled={busy} className={`${primaryButton} w-full`}>
                  {busy ? (
                    <RefreshCw size={17} className="animate-spin" />
                  ) : (
                    <Plus size={17} />
                  )}
                  {busy ? "Saving product..." : "Add product"}
                </button>
              </form>
            </div>
          )}

          <div className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${isAdmin ? "xl:col-span-3" : "xl:col-span-2"}`}>
            <div className="border-b border-slate-100 p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <SectionHeading
                  icon={Layers3}
                  title="Product catalog"
                  subtitle="Browse and search your current products."
                />
                <span className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">
                  {filteredProducts.length} items
                </span>
              </div>

              <div className="relative mt-5">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className={`${inputClass} pl-11`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by product, SKU or category..."
                />
              </div>
            </div>

            {loading ? (
              <LoadingState />
            ) : filteredProducts.length === 0 ? (
              <EmptyState
                title={search ? "No matching products" : "Your catalog is empty"}
                text={
                  search
                    ? "Try a different product name, SKU or category."
                    : "Add your first product or import a CSV file to get started."
                }
                icon={Package}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-4 font-bold">Product</th>
                      <th className="px-4 py-4 font-bold">SKU</th>
                      <th className="px-4 py-4 font-bold">Category</th>
                      <th className="px-4 py-4 text-right font-bold">Price</th>
                      <th className="px-5 py-4 text-right font-bold">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((item, index) => {
                      const stock = Number(item.inventory ?? item.stock ?? 0);
                      return (
                        <tr
                          key={item.id ?? item.sku ?? index}
                          className="transition hover:bg-indigo-50/40"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                                <Package size={19} />
                              </div>
                              <span className="font-semibold text-slate-800">
                                {item.name || "Unnamed product"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-slate-500">
                            {item.sku || "—"}
                          </td>
                          <td className="px-4 py-4">
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600">
                              {item.category || "General"}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-slate-800">
                            {money(item.current_price ?? item.currentPrice)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className={`inline-flex rounded-lg px-2.5 py-1.5 text-xs font-bold ${stock <= 5 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                              {stock.toLocaleString("en-IN")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-xs text-slate-400">
              <span>Product inventory overview</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Data from your workspace
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Data imports */}
      {!isAdmin && tab === "imports" && (
        <section>
          <SectionHeading
            icon={FileUp}
            title="Import your data"
            subtitle="Upload CSV files to quickly populate products and sales history."
          />
          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
            <ImportPanel
              title="Product catalog"
              description="Import product names, prices, costs and stock."
              file={productFile}
              preview={productPreview}
              busy={busy}
              onFile={(file) => inspectFile(file, "products")}
              onImport={() => importFile("products")}
              onTemplate={() => downloadTemplate("products")}
            />
            <ImportPanel
              title="Sales history"
              description="Import sales dates, quantities and unit prices."
              file={salesFile}
              preview={salesPreview}
              busy={busy}
              onFile={(file) => inspectFile(file, "sales")}
              onImport={() => importFile("sales")}
              onTemplate={() => downloadTemplate("sales")}
            />
          </div>
        </section>
      )}

      {/* Price approvals */}
      {!isAdmin && tab === "approvals" && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <SectionHeading
              icon={TrendingUp}
              title="Price recommendations"
              subtitle="Review suggested prices and record your decision."
            />
          </div>

          {loading ? (
            <LoadingState />
          ) : recommendations.length === 0 ? (
            <EmptyState
              title="No recommendations yet"
              text="Run price optimization to generate pricing suggestions."
              icon={TrendingUp}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-bold">Product</th>
                    <th className="px-4 py-4 text-right font-bold">Current price</th>
                    <th className="px-4 py-4 text-right font-bold">Suggested price</th>
                    <th className="px-4 py-4 font-bold">Status</th>
                    <th className="px-5 py-4 font-bold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recommendations.map((item) => {
                    const status = String(item.status || "pending").toLowerCase();
                    return (
                      <tr key={item.id} className="transition hover:bg-slate-50/80">
                        <td className="px-5 py-4 font-semibold">
                          {item.product_name || item.product || `#${item.id}`}
                        </td>
                        <td className="px-4 py-4 text-right text-slate-500">
                          {money(item.current_price ?? item.currentPrice)}
                        </td>
                        <td className="px-4 py-4 text-right font-bold text-indigo-700">
                          {money(item.recommended_price ?? item.recommendedPrice)}
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={status} />
                        </td>
                        <td className="px-5 py-4">
                          {status === "pending" ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                title="Approve recommendation"
                                disabled={decisionId === item.id}
                                onClick={() => decide(item, "approved")}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                              >
                                <CheckCircle2 size={15} />
                                Approve
                              </button>
                              <button
                                type="button"
                                title="Reject recommendation"
                                disabled={decisionId === item.id}
                                onClick={() => decide(item, "rejected")}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                              >
                                <XCircle size={15} />
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Decision recorded</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

function StatCard({ title, value, caption, icon: Icon, tone }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600",
    blue: "bg-sky-50 text-sky-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };

  return (
    <article className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tones[tone]}`}>
          <Icon size={23} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <ArrowUpRight size={14} className="text-emerald-500" />
        {caption}
      </div>
    </article>
  );
}

function SectionHeading({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <h2 className="font-bold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-1 text-sm leading-5 text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function NavTab({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      }`}
    >
      <Icon size={17} />
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    approved: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    rejected: "bg-red-50 text-red-700 ring-red-200",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold capitalize ring-1 ring-inset ${styles[status] || "bg-slate-100 text-slate-600 ring-slate-200"}`}>
      {status === "pending" ? <Clock3 size={13} /> : <CheckCircle2 size={13} />}
      {status}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14">
      <RefreshCw size={25} className="animate-spin text-indigo-500" />
      <p className="mt-3 text-sm font-medium text-slate-600">Loading your data...</p>
      <p className="mt-1 text-xs text-slate-400">Please wait a moment</p>
    </div>
  );
}

function EmptyState({ title, text, icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon size={26} />
      </div>
      <h3 className="mt-4 font-bold text-slate-800">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function ImportPanel({
  title,
  description,
  file,
  preview,
  busy,
  onFile,
  onImport,
  onTemplate,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6">
      <SectionHeading
        icon={FileSpreadsheet}
        title={title}
        subtitle={description}
      />

      <div className="mt-5 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-6 text-center transition hover:border-indigo-400 hover:bg-indigo-50">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm">
          <Upload size={25} />
        </div>
        <h3 className="mt-4 text-sm font-bold text-slate-800">
          {file ? "File ready to import" : "Upload your CSV file"}
        </h3>
        <p className="mt-2 break-all text-xs text-slate-500">
          {file?.name || "Choose a .csv file from your computer"}
        </p>

        <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700">
          <FileUp size={17} />
          Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              onFile(event.target.files?.[0] || null);
              event.target.value = "";
            }}
          />
        </label>

        <p className="mt-3 text-[11px] text-slate-400">
          CSV format only
        </p>
      </div>

      <button
        type="button"
        onClick={onTemplate}
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 transition hover:text-indigo-800"
      >
        <Download size={16} />
        Download sample template
      </button>

      {preview.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center justify-between bg-slate-50 px-3 py-3">
            <p className="text-xs font-bold text-slate-700">File preview</p>
            <span className="text-[11px] text-slate-400">
              First {preview.length} rows
            </span>
          </div>
          <div className="max-h-48 overflow-auto">
            <table className="w-full text-left text-xs">
              <tbody>
                {preview.map((row, i) => (
                  <tr
                    key={i}
                    className={i === 0 ? "bg-indigo-50 font-bold text-indigo-800" : "border-t border-slate-100 text-slate-600"}
                  >
                    {row.map((cell, j) => (
                      <td key={j} className="whitespace-nowrap px-3 py-2.5">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onImport}
        disabled={busy || !file}
        className={`${primaryButton} mt-5 w-full`}
      >
        {busy ? (
          <RefreshCw size={17} className="animate-spin" />
        ) : (
          <Upload size={17} />
        )}
        {busy ? "Importing data..." : "Import CSV"}
      </button>
    </section>
  );
}
