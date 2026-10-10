
import { useEffect, useState } from "react";

const API = "http://127.0.0.1:5000";

const initialProduct = {
  sku: "",
  name: "",
  brand: "",
  model: "",
  category: "Electronics",
  currentPrice: "",
  unitCost: "",
  inventory: "",
  minMarginPct: "0",
  maxDiscountPct: "30",
  region: "",
};

function headers(token, json = true) {
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

export default function AccountWorkspace({ token, user }) {
  const [retailers, setRetailers] = useState([]);
  const [products, setProducts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [form, setForm] = useState({
    displayName: "",
    username: "",
    password: "",
  });
  const [product, setProduct] = useState(initialProduct);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function readResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
  }

  async function load() {
    setLoading(true);
    setError("");

    try {
      if (user.role === "admin") {
        const response = await fetch(`${API}/api/admin/retailers`, {
          headers: headers(token, false),
        });
        setRetailers(await readResponse(response));
      } else {
        const [productResponse, recommendationResponse] = await Promise.all([
          fetch(`${API}/api/products`, {
            headers: headers(token, false),
          }),
          fetch(`${API}/api/recommendations`, {
            headers: headers(token, false),
          }),
        ]);

        const [productData, recommendationData] = await Promise.all([
          readResponse(productResponse),
          readResponse(recommendationResponse),
        ]);

        setProducts(productData);
        setRecommendations(recommendationData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [token, user.role]);

  async function createRetailer(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API}/api/admin/retailers`, {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify(form),
      });

      await readResponse(response);
      setMessage("Retailer account created successfully.");
      setForm({ displayName: "", username: "", password: "" });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleRetailer(retailer) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API}/api/admin/retailers/${retailer.id}`,
        {
          method: "PATCH",
          headers: headers(token),
          body: JSON.stringify({ active: !retailer.active }),
        }
      );

      await readResponse(response);
      setMessage(
        `${retailer.display_name} account ${
          retailer.active ? "deactivated" : "activated"
        }.`
      );
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addProduct(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const payload = {
        ...product,
        currentPrice: Number(product.currentPrice),
        unitCost: Number(product.unitCost),
        inventory: Number(product.inventory),
        minMarginPct: Number(product.minMarginPct),
        maxDiscountPct: Number(product.maxDiscountPct),
      };

      const response = await fetch(`${API}/api/products`, {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify(payload),
      });

      await readResponse(response);
      setMessage("Product saved to your account.");
      setProduct(initialProduct);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadCsv(event, endpoint, label) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: headers(token, false),
        body: formData,
      });

      const data = await readResponse(response);
      setMessage(
        `${label}: imported ${data.accepted ?? 0} rows; ${
          data.errorCount ?? 0
        } rows had errors.`
      );

      if (data.errors?.length) {
        setError(JSON.stringify(data.errors.slice(0, 5)));
      }

      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      event.target.value = "";
    }
  }

  async function decide(id, decision) {
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API}/api/recommendations/${id}/decision`,
        {
          method: "POST",
          headers: headers(token),
          body: JSON.stringify({ decision }),
        }
      );

      const data = await readResponse(response);
      setMessage(data.message || `Recommendation ${decision}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-blue-700">
          {user.role === "admin"
            ? "PLATFORM ADMINISTRATION"
            : "SHOP SETUP & OPERATIONS"}
        </p>

        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {user.role === "admin"
            ? "Retailer account management"
            : "Products, data & approvals"}
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          {user.role === "admin"
            ? "Create retailer accounts and control their access."
            : "Step 1: add products. Step 2: import sales. Step 3: optimize and review recommendations. Your data belongs to this account."}
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

      {error && (
        <div className="break-words rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {user.role === "admin" ? (
        <>
          <section className="rounded-2xl border bg-white p-6">
            <h2 className="font-semibold">Create retailer account</h2>
            <p className="mb-4 mt-1 text-sm text-slate-500">
              Create credentials for the shop owner. Share the password
              privately and securely.
            </p>

            <form
              onSubmit={createRetailer}
              className="grid gap-3 md:grid-cols-3"
            >
              <input
                required
                placeholder="Retailer display name"
                className="rounded-xl border p-3"
                value={form.displayName}
                onChange={(e) =>
                  setForm({ ...form, displayName: e.target.value })
                }
              />

              <input
                required
                placeholder="Username"
                className="rounded-xl border p-3"
                value={form.username}
                onChange={(e) =>
                  setForm({ ...form, username: e.target.value })
                }
              />

              <input
                required
                minLength={12}
                type="password"
                placeholder="Temporary password (12+ chars)"
                className="rounded-xl border p-3"
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
              />

              <button className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white md:col-span-3">
                Create account
              </button>
            </form>
          </section>

          <section className="rounded-2xl border bg-white p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Retailer accounts</h2>
              <button
                onClick={load}
                className="rounded-lg border px-3 py-2 text-sm"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <p className="py-5 text-sm text-slate-500">Loading…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="p-3">Retailer</th>
                      <th className="p-3">Username</th>
                      <th className="p-3">Products</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {retailers.map((retailer) => (
                      <tr key={retailer.id} className="border-b">
                        <td className="p-3">{retailer.display_name}</td>
                        <td className="p-3">{retailer.username}</td>
                        <td className="p-3">{retailer.product_count}</td>
                        <td className="p-3">
                          {retailer.active ? "Active" : "Disabled"}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => toggleRetailer(retailer)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                              retailer.active
                                ? "border border-red-200 text-red-700"
                                : "bg-emerald-600 text-white"
                            }`}
                          >
                            {retailer.active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <section className="rounded-2xl border bg-white p-6">
            <h2 className="font-semibold">1. Import product catalog</h2>
            <p className="my-2 text-sm text-slate-500">
              Required columns: sku,name,category,currentPrice,unitCost,inventory.
              Optional: brand,model,minMarginPct,maxDiscountPct,region.
            </p>

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) =>
                uploadCsv(event, "/api/products/import", "Product import")
              }
              className="block w-full rounded-xl border p-3"
            />
          </section>

          <section className="rounded-2xl border bg-white p-6">
            <h2 className="font-semibold">2. Import sales history</h2>
            <p className="my-2 text-sm text-slate-500">
              Required columns: sku,date,quantity,unitPrice. Optional:
              region,customerType. Dates must use YYYY-MM-DD. Each SKU must
              already exist in your product catalog.
            </p>

            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) =>
                uploadCsv(event, "/api/sales/import", "Sales import")
              }
              className="block w-full rounded-xl border p-3"
            />
          </section>

          <section className="rounded-2xl border bg-white p-6">
            <h2 className="mb-4 font-semibold">3. Add a product manually</h2>

            <form
              onSubmit={addProduct}
              className="grid gap-3 md:grid-cols-3"
            >
              {[
                ["sku", "SKU"],
                ["name", "Product name"],
                ["brand", "Brand"],
                ["model", "Model"],
                ["category", "Category"],
                ["currentPrice", "Current price (INR)"],
                ["unitCost", "Unit cost (INR)"],
                ["inventory", "Inventory"],
                ["minMarginPct", "Minimum margin %"],
                ["maxDiscountPct", "Maximum discount %"],
                ["region", "Region"],
              ].map(([key, label]) => (
                <label key={key} className="text-sm font-medium">
                  {label}
                  <input
                    required={!["brand", "model", "region"].includes(key)}
                    type={
                      [
                        "currentPrice",
                        "unitCost",
                        "inventory",
                        "minMarginPct",
                        "maxDiscountPct",
                      ].includes(key)
                        ? "number"
                        : "text"
                    }
                    min={
                      key === "currentPrice"
                        ? "0.01"
                        : [
                            "unitCost",
                            "inventory",
                            "minMarginPct",
                            "maxDiscountPct",
                          ].includes(key)
                        ? "0"
                        : undefined
                    }
                    step="any"
                    className="mt-1 w-full rounded-xl border p-3 font-normal"
                    value={product[key]}
                    onChange={(e) =>
                      setProduct({ ...product, [key]: e.target.value })
                    }
                  />
                </label>
              ))}

              <button className="rounded-xl bg-blue-600 p-3 font-semibold text-white md:col-span-3">
                Save product
              </button>
            </form>
          </section>

          <section className="rounded-2xl border bg-white p-6">
            <h2 className="mb-3 font-semibold">
              My products ({products.length})
            </h2>

            {products.length === 0 ? (
              <p className="text-sm text-slate-500">
                No products yet. Add a product or import your CSV.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="p-3">SKU</th>
                      <th className="p-3">Product</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Price</th>
                      <th className="p-3">Cost</th>
                      <th className="p-3">Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((item) => (
                      <tr key={item.id} className="border-b">
                        <td className="p-3">{item.sku}</td>
                        <td className="p-3">{item.name}</td>
                        <td className="p-3">{item.category}</td>
                        <td className="p-3">
                          ₹{Number(item.currentPrice).toLocaleString("en-IN")}
                        </td>
                        <td className="p-3">
                          ₹{Number(item.unitCost).toLocaleString("en-IN")}
                        </td>
                        <td className="p-3">{item.inventory}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border bg-white p-6">
            <h2 className="mb-3 font-semibold">
              Price recommendation approvals
            </h2>

            {recommendations.length === 0 ? (
              <p className="text-sm text-slate-500">
                No recommendations yet. Run an optimization first.
              </p>
            ) : (
              <div className="space-y-3">
                {recommendations.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
                  >
                    <div>
                      <div className="font-semibold">
                        {item.product_name} · {item.objective}
                      </div>
                      <div className="text-sm text-slate-600">
                        {`₹${Number(item.current_price).toLocaleString("en-IN")} → ₹${Number(item.recommended_price).toLocaleString("en-IN")} · ${item.status}`}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.reason} · {item.created_at}
                      </div>
                    </div>

                    {item.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => decide(item.id, "approved")}
                          className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => decide(item.id, "rejected")}
                          className="rounded-lg border px-3 py-2 text-sm"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
