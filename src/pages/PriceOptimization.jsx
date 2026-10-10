import { useEffect, useMemo, useState } from "react";
import {
  Target,
  Sparkles,
  Loader2,
  Package,
  Percent,
  Users,
  MapPin,
  IndianRupee,
  TrendingUp,
  ShoppingCart,
} from "lucide-react";

const API = "http://127.0.0.1:5000";

const currency = (value) =>
  `₹${Number(value ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;

const formatNumber = (value) =>
  Number(value ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });

const inputClass =
  "block min-h-12 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm leading-5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-50";

export default function PriceOptimization({ token, user }) {
  const [catalog, setCatalog] = useState({
    categories: [],
    productsByCategory: {},
  });

  const [category, setCategory] = useState("");
  const [product, setProduct] = useState(null);

  // Keep editable number inputs as strings so empty fields stay empty.
  const [currentPrice, setCurrentPrice] = useState("");
  const [inventory, setInventory] = useState("");
  const [discount, setDiscount] = useState("5");
  const [competitorPrice, setCompetitorPrice] = useState("");

  const [promotion, setPromotion] = useState("None");
  const [region, setRegion] = useState("West");
  const [customerType, setCustomerType] = useState("Retail");
  const [objective, setObjective] = useState("Demand");

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
          throw new Error(
            data.error || "Unable to load the product catalog."
          );
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
    setInventory(
      firstProduct?.inventory != null
        ? String(firstProduct.inventory)
        : ""
    );

    setCompetitorPrice("");
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
    setCurrentPrice(
      selectedProduct.currentPrice != null
        ? String(selectedProduct.currentPrice)
        : ""
    );
    setInventory(
      selectedProduct.inventory != null
        ? String(selectedProduct.inventory)
        : ""
    );

    setCompetitorPrice("");
    setResult(null);
    setError("");
  };

  const analyze = async () => {
    if (!product) {
      setError("Please select a product first.");
      return;
    }

    if (currentPrice.trim() === "" || Number(currentPrice) <= 0) {
      setError("Current price must be greater than zero.");
      return;
    }

    if (inventory.trim() === "" || Number(inventory) <= 0) {
      setError("Enter available inventory greater than zero.");
      return;
    }

    if (
      !Number.isFinite(Number(discount)) ||
      discount.trim() === "" ||
      Number(discount) < 0 ||
      Number(discount) >= 100
    ) {
      setError("Discount must be between 0% and 99.99%.");
      return;
    }

    if (
      competitorPrice.trim() !== "" &&
      (!Number.isFinite(Number(competitorPrice)) ||
        Number(competitorPrice) < 0)
    ) {
      setError("Competitor price cannot be negative.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API}/api/optimize-price`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category,
          productId: product.id,
          product: product.name,
          currentPrice: Number(currentPrice),
          inventory: Number(inventory),
          discount: Number(discount),
          promotion,
          competitorPrice:
            competitorPrice.trim() === ""
              ? 0
              : Number(competitorPrice),
          region,
          customerType,
          objective,
          basePrice: product.basePrice,
          unitCost: product.unitCost,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Price optimization failed.");
      }

      setResult(data);
    } catch (err) {
      setError(
        err.message || "Unable to optimize the selected product's price."
      );
    } finally {
      setLoading(false);
    }
  };

  const candidates = useMemo(() => {
    if (!result?.candidates) return [];

    const selectedObjective = result.objective || objective;

    const objectiveKey = {
      Profit: "expectedProfit",
      Revenue: "expectedRevenue",
      Demand: "predictedDemand",
    }[selectedObjective];

    if (!objectiveKey) return result.candidates.slice(0, 8);

    return [...result.candidates]
      .sort(
        (a, b) =>
          Number(b[objectiveKey] ?? 0) -
          Number(a[objectiveKey] ?? 0)
      )
      .slice(0, 8);
  }, [result, objective]);

  return (
    <div className="min-w-0 space-y-6">
      {/* Page heading */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Pricing intelligence
          </p>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Price Optimization
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Compare pricing scenarios using product data, inventory,
            discounts, promotions and optional competitor pricing.
          </p>
        </div>

        <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
          <Sparkles size={16} />
          Pricing assistant
        </div>
      </header>

      {/* Catalog empty state */}
      {!catalogLoading && catalog.categories.length === 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-semibold text-amber-900">
            Your product catalog is empty
          </h2>

          <p className="mt-2 text-sm leading-6 text-amber-800">
            Add products and import your sales history before running price
            optimization.
          </p>
        </section>
      )}

      {/* Pricing settings */}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Target size={23} />
          </div>

          <div className="min-w-0">
            <h2 className="font-semibold text-slate-900">
              Optimization settings
            </h2>

            <p className="mt-1 text-sm leading-5 text-slate-500">
              Choose a product and configure the pricing scenario.
            </p>
          </div>
        </div>

        {catalogLoading ? (
          <div className="flex items-center justify-center gap-3 p-10 text-sm text-slate-500">
            <Loader2 className="animate-spin" size={19} />
            Loading product catalog...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-x-5 gap-y-5 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
              <Field label="Product category">
                <select
                  value={category}
                  onChange={handleCategoryChange}
                  className={inputClass}
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
                  value={product?.id ?? ""}
                  onChange={handleProductChange}
                  className={inputClass}
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
                    min="0.01"
                    step="0.01"
                    value={currentPrice}
                    onChange={(event) =>
                      setCurrentPrice(event.target.value)
                    }
                    placeholder="Enter current price"
                  />
                </div>
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
                    min="0"
                    step="1"
                    value={inventory}
                    onChange={(event) => setInventory(event.target.value)}
                    placeholder="Enter stock quantity"
                  />
                </div>
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

              <Field label="Competitor price (₹)">
                <div className="relative">
                  <IndianRupee
                    size={17}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    className={`${inputClass} pl-10`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={competitorPrice}
                    onChange={(event) =>
                      setCompetitorPrice(event.target.value)
                    }
                    placeholder="Optional"
                  />
                </div>

                <p className="mt-1.5 text-xs leading-5 text-slate-400">
                  Enter an actual observed price.
                </p>
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
                  <option value="Save 10%">Save 10%</option>
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

              <Field label="Optimization objective">
                <select
                  className={inputClass}
                  value={objective}
                  onChange={(event) => {
                    setObjective(event.target.value);
                    setResult(null);
                  }}
                >
                  <option value="Demand">Maximize demand</option>
                  <option value="Revenue">Maximize revenue</option>
                  <option value="Profit">Maximize profit</option>
                </select>
              </Field>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="max-w-xl text-xs leading-5 text-slate-500">
                Recommendations are estimates. Review the results before
                approving a price change.
              </p>

              <button
                type="button"
                onClick={analyze}
                disabled={loading || !product}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Sparkles size={18} />
                )}

                {loading ? "Evaluating scenarios..." : "Optimize price"}
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

      {/* Optimization results */}
      {result && (
        <div className="min-w-0 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Optimization complete
            </p>

            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Recommended pricing scenario
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Review the estimated business outcomes below.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ResultCard
              title="Recommended price"
              value={currency(result.recommendedPrice)}
              description="Suggested selling price"
              icon={IndianRupee}
              highlight
            />

            <ResultCard
              title="Predicted demand"
              value={formatNumber(result.predictedDemand)}
              description="Estimated quantity"
              icon={ShoppingCart}
            />

            <ResultCard
              title="Expected revenue"
              value={currency(result.expectedRevenue)}
              description="Estimated sales revenue"
              icon={TrendingUp}
            />

            <ResultCard
              title="Expected profit"
              value={currency(result.expectedProfit)}
              description="Estimated profit"
              icon={Target}
            />
          </div>

          {result.approvalRequired && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-900">
                Approval required
              </h3>

              <p className="mt-1 text-sm leading-6 text-amber-800">
                Recommendation #{result.recommendationId} is pending.
                Review it in Products &amp; Data Import and approve or reject
                it there. Approval updates the local application record only;
                it does not change an external storefront.
              </p>
            </section>
          )}

          {/* Scenario explanation */}
          <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:p-6">
            <h3 className="font-semibold text-blue-950">
              How to interpret this result
            </h3>

            <p className="mt-3 text-sm leading-6 text-blue-900">
              <strong>{result.category}</strong>
              {" / "}
              <strong>{result.product}</strong>
              {result.model ? ` / ${result.model}` : ""}
            </p>

            <p className="mt-3 text-sm leading-6 text-blue-900">
              Demand estimates depend on available product history and model
              assumptions. Treat the recommendation as a scenario to
              evaluate, not a guarantee of future sales.
            </p>

            {result.optimizationDiagnostics && (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Diagnostic
                  label="Prices evaluated"
                  value={formatNumber(
                    result.optimizationDiagnostics.candidateCount
                  )}
                />

                <Diagnostic
                  label="Lowest candidate"
                  value={currency(
                    result.optimizationDiagnostics.minCandidatePrice
                  )}
                />

                <Diagnostic
                  label="Highest candidate"
                  value={currency(
                    result.optimizationDiagnostics.maxCandidatePrice
                  )}
                />
              </div>
            )}

            <p className="mt-4 text-xs leading-5 text-blue-800">
              Objective: {result.objective || objective}. Competitor price:{" "}
              {competitorPrice.trim() !== "" &&
              Number(competitorPrice) > 0
                ? currency(competitorPrice)
                : "Not supplied"}
              .
            </p>
          </section>

          {/* Candidate comparison */}
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <h3 className="font-semibold text-slate-900">
                Price candidate comparison
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Compare evaluated scenarios for your selected objective.
              </p>
            </div>

            {candidates.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                No candidate comparison data was returned.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Price</th>
                      <th className="px-5 py-3 font-semibold">Demand</th>
                      <th className="px-5 py-3 font-semibold">Revenue</th>
                      <th className="px-5 py-3 font-semibold">Profit</th>
                      <th className="px-5 py-3 font-semibold">
                        Demand basis
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {candidates.map((candidate) => {
                      const recommended =
                        Number(candidate.price) ===
                        Number(result.recommendedPrice);

                      return (
                        <tr
                          key={candidate.price}
                          className={
                            recommended
                              ? "bg-blue-50/80"
                              : "transition hover:bg-slate-50"
                          }
                        >
                          <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                            {currency(candidate.price)}

                            {recommended && (
                              <span className="ml-2 inline-block rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                                Recommended
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {formatNumber(candidate.predictedDemand)}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                            {currency(candidate.expectedRevenue)}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                            {currency(candidate.expectedProfit)}
                          </td>

                          <td className="px-5 py-4 text-slate-500">
                            {candidate.demandSource ||
                              "Available sales history"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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

function ResultCard({
  title,
  value,
  description,
  icon: Icon,
  highlight = false,
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border p-5 shadow-sm ${
        highlight
          ? "border-blue-200 bg-blue-50/70"
          : "border-slate-200 bg-white"
      }`}
    >
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
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            highlight
              ? "bg-blue-100 text-blue-700"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          <Icon size={19} />
        </div>
      </div>
    </div>
  );
}

function Diagnostic({ label, value }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-white/80 p-3">
      <p className="text-xs text-blue-700">{label}</p>

      <p className="mt-1 break-words text-base font-bold text-blue-950">
        {value}
      </p>
    </div>
  );
}