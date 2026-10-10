import { useEffect, useMemo, useState } from "react";
import {
  FlaskConical,
  ArrowRight,
  Loader2,
  Package,
  IndianRupee,
  Percent,
  MapPin,
  Users,
  TrendingUp,
  ShoppingCart,
  Target,
} from "lucide-react";

const API = "http://127.0.0.1:5000";

const inputClass =
  "block min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm leading-5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 disabled:cursor-not-allowed disabled:bg-slate-50";

const currency = (value) =>
  `₹${Number(value ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const formatNumber = (value) =>
  Number(value ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });

export default function WhatIfAnalysis({ token }) {
  const [catalog, setCatalog] = useState({
    categories: [],
    productsByCategory: {},
  });

  const [category, setCategory] = useState("");
  const [product, setProduct] = useState(null);

  const [currentPrice, setCurrentPrice] = useState("");
  const [scenarioPrice, setScenarioPrice] = useState("");
  const [inventory, setInventory] = useState("");
  const [discount, setDiscount] = useState("10");

  const [promotion, setPromotion] = useState("None");
  const [region, setRegion] = useState("");
  const [customerType, setCustomerType] = useState("Retail");

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setCatalogLoading(true);
      setError("");

      try {
        const response = await fetch(`${API}/api/catalog`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load product catalog.");
        }

        if (cancelled) return;

        setCatalog({
          categories: data.categories || [],
          productsByCategory: data.productsByCategory || {},
        });

        setCategory(data.categories?.[0] || "");
      } catch (err) {
        if (!cancelled) {
          setError(
            err.message ||
              "Unable to connect to the backend. Start Flask on port 5000."
          );
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const categoryProducts = useMemo(
    () => catalog.productsByCategory?.[category] || [],
    [catalog, category]
  );

  useEffect(() => {
    const firstProduct = categoryProducts[0] || null;

    setProduct(firstProduct);

    setCurrentPrice(
      firstProduct?.currentPrice != null
        ? String(firstProduct.currentPrice)
        : ""
    );

    setScenarioPrice(
      firstProduct?.currentPrice != null
        ? String(firstProduct.currentPrice)
        : ""
    );

    setInventory(
      firstProduct?.inventory != null
        ? String(firstProduct.inventory)
        : ""
    );

    setRegion(firstProduct?.region || "");
    setResult(null);
    setError("");
  }, [category, categoryProducts]);

  const handleCategoryChange = (event) => {
    setCategory(event.target.value);
  };

  const handleProductChange = (event) => {
    const selectedProduct = categoryProducts.find(
      (item) => String(item.id) === event.target.value
    );

    if (!selectedProduct) return;

    setProduct(selectedProduct);

    const price =
      selectedProduct.currentPrice != null
        ? String(selectedProduct.currentPrice)
        : "";

    setCurrentPrice(price);
    setScenarioPrice(price);

    setInventory(
      selectedProduct.inventory != null
        ? String(selectedProduct.inventory)
        : ""
    );

    setRegion(selectedProduct.region || "");
    setResult(null);
    setError("");
  };

  const runSimulation = async () => {
    if (!product) {
      setError("Please select a product first.");
      return;
    }

    if (
      currentPrice.trim() === "" ||
      !Number.isFinite(Number(currentPrice)) ||
      Number(currentPrice) <= 0
    ) {
      setError("The selected product must have a valid current price.");
      return;
    }

    if (
      scenarioPrice.trim() === "" ||
      !Number.isFinite(Number(scenarioPrice)) ||
      Number(scenarioPrice) <= 0
    ) {
      setError("What-If price must be greater than zero.");
      return;
    }

    if (
      inventory.trim() === "" ||
      !Number.isFinite(Number(inventory)) ||
      Number(inventory) < 0
    ) {
      setError("The product must have a valid inventory quantity.");
      return;
    }

    if (
      discount.trim() === "" ||
      !Number.isFinite(Number(discount)) ||
      Number(discount) < 0 ||
      Number(discount) >= 100
    ) {
      setError("Discount must be between 0% and 99.99%.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API}/api/what-if`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category,
          productId: product.id,
          product: product.name,
          scenarioPrice: Number(scenarioPrice),
          discount: Number(discount),
          promotion,
          region,
          customerType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "What-If simulation failed.");
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Unable to run the simulation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-w-0 space-y-6">
      {/* Page heading */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-purple-600">
            Scenario planning
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            What-If Analysis
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Compare your current price against a proposed price and review
            estimated changes in demand, revenue and profit.
          </p>
        </div>

        <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-purple-100 bg-purple-50 px-3 py-2 text-sm font-medium text-purple-700">
          <FlaskConical size={17} />
          Scenario lab
        </div>
      </header>

      {/* Empty catalog state */}
      {!catalogLoading && catalog.categories.length === 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-900">
            Your product catalog is empty
          </h2>

          <p className="mt-2 text-sm leading-6 text-amber-800">
            Add products and import sales history before running a What-If
            simulation.
          </p>
        </section>
      )}

      {/* Scenario settings */}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <FlaskConical size={23} />
          </div>

          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">
              Scenario settings
            </h2>

            <p className="mt-1 text-sm leading-5 text-slate-500">
              Select a product and enter the price you want to evaluate.
            </p>
          </div>
        </div>

        {catalogLoading ? (
          <div className="flex items-center justify-center gap-3 p-10 text-sm text-slate-500">
            <Loader2 size={19} className="animate-spin" />
            Loading product catalog...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-x-5 gap-y-5 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
              <Field label="Product category">
                <select
                  className={inputClass}
                  value={category}
                  onChange={handleCategoryChange}
                  disabled={catalog.categories.length === 0}
                >
                  {catalog.categories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Select product">
                <select
                  className={inputClass}
                  value={product?.id ?? ""}
                  onChange={handleProductChange}
                  disabled={categoryProducts.length === 0}
                >
                  {categoryProducts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Current price (₹)">
                <div className="relative">
                  <IndianRupee
                    size={17}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    className={`${inputClass} pl-10`}
                    type="number"
                    value={currentPrice}
                    readOnly
                    aria-readonly="true"
                  />
                </div>
              </Field>

              <Field label="What-If price (₹)">
                <div className="relative">
                  <IndianRupee
                    size={17}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    className={`${inputClass} pl-10`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={scenarioPrice}
                    onChange={(event) =>
                      setScenarioPrice(event.target.value)
                    }
                    placeholder="Enter scenario price"
                  />
                </div>

                <p className="mt-1.5 text-xs leading-5 text-slate-400">
                  Change this price to compare the outcome.
                </p>
              </Field>

              <Field label="Available inventory">
                <div className="relative">
                  <Package
                    size={17}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    className={`${inputClass} pl-10`}
                    type="number"
                    value={inventory}
                    readOnly
                    aria-readonly="true"
                  />
                </div>

                <p className="mt-1.5 text-xs leading-5 text-slate-400">
                  Loaded from your product record.
                </p>
              </Field>

              <Field label="Discount (%)">
                <div className="relative">
                  <Percent
                    size={17}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    className={`${inputClass} pl-10`}
                    type="number"
                    min="0"
                    max="99.99"
                    step="0.5"
                    value={discount}
                    onChange={(event) => setDiscount(event.target.value)}
                    placeholder="0"
                  />
                </div>
              </Field>

              <Field label="Promotion">
                <select
                  className={inputClass}
                  value={promotion}
                  onChange={(event) => setPromotion(event.target.value)}
                >
                  <option value="None">No promotion</option>
                  <option value="Black Friday">Black Friday</option>
                  <option value="Bundle Offer">Bundle offer</option>
                  <option value="Free Shipping">Free shipping</option>
                  <option value="FOODIE10">FOODIE10</option>
                </select>
              </Field>

              <Field label="Region">
                <div className="relative">
                  <MapPin
                    size={17}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    className={`${inputClass} pl-10`}
                    value={region}
                    onChange={(event) => setRegion(event.target.value)}
                    placeholder="Enter region"
                  />
                </div>
              </Field>

              <Field label="Customer type">
                <div className="relative">
                  <Users
                    size={17}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    className={`${inputClass} pl-10`}
                    value={customerType}
                    onChange={(event) =>
                      setCustomerType(event.target.value)
                    }
                    placeholder="Retail"
                  />
                </div>
              </Field>
            </div>

            {/* Action bar */}
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="max-w-xl text-xs leading-5 text-slate-500">
                Results depend on available sales history and model
                assumptions. They are estimates, not guaranteed outcomes.
              </p>

              <button
                type="button"
                onClick={runSimulation}
                disabled={loading || !product}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <FlaskConical size={18} />
                )}

                {loading ? "Running simulation..." : "Run What-If Simulation"}

                {!loading && <ArrowRight size={17} />}
              </button>
            </div>
          </>
        )}
      </section>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"
        >
          {error}
        </div>
      )}

      {/* Simulation results */}
      {result && (
        <div className="min-w-0 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Simulation complete
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Scenario comparison
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Compare the current price with your proposed price.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Compare
              title="Current price"
              data={result.current}
              icon={Target}
            />

            <Compare
              title="What-If price"
              data={result.scenario}
              icon={FlaskConical}
              highlight
            />
          </div>

          <section className="rounded-2xl border border-purple-100 bg-purple-50/70 p-5 sm:p-6">
            <h3 className="font-semibold text-purple-950">
              Impact of your scenario
            </h3>

            <p className="mt-1 text-sm leading-5 text-purple-800">
              Estimated changes between the current and proposed price.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Metric
                label="Demand change"
                value={result.demandChange}
              />

              <Metric
                label="Revenue change"
                value={currency(result.revenueChange)}
              />

              <Metric
                label="Profit change"
                value={currency(result.profitChange)}
              />
            </div>

            <div className="mt-5 border-t border-purple-200 pt-4">
              <p className="text-sm leading-6 text-purple-900">
                <strong>{result.category}</strong>
                {" / "}
                <strong>{result.product}</strong>
                {result.model ? ` / ${result.model}` : ""}
              </p>

              <p className="mt-2 text-xs leading-5 text-purple-800">
                Predictions are estimates. Validate the results against your
                shop's sales history before making pricing decisions.
              </p>
            </div>
          </section>
        </div>
      )}
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

function Compare({ title, data, icon: Icon, highlight = false }) {
  if (!data) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="mt-3 text-sm text-slate-500">
          Comparison data is unavailable.
        </p>
      </section>
    );
  }

  return (
    <section
      className={`min-w-0 rounded-2xl border p-5 shadow-sm ${
        highlight
          ? "border-purple-200 bg-purple-50/50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            highlight
              ? "bg-purple-100 text-purple-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          <Icon size={19} />
        </div>

        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            Estimated business outcomes
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric
          label="Demand"
          value={formatNumber(data.predictedDemand)}
        />

        <Metric
          label="Revenue"
          value={currency(data.expectedRevenue)}
        />

        <Metric
          label="Profit"
          value={currency(data.expectedProfit)}
        />
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200/70 bg-white/80 p-3">
      <p className="text-xs leading-5 text-slate-500">{label}</p>

      <p className="mt-1 break-words text-lg font-bold text-slate-900">
        {value ?? "—"}
      </p>
    </div>
  );
}