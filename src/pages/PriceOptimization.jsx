import { useEffect, useMemo, useState } from 'react';
import { Target, IndianRupee, Sparkles, Loader2, Package, Percent, Users, MapPin, ShoppingCart } from 'lucide-react';

const API = 'http://127.0.0.1:5000';

export default function PriceOptimization({ token, user }) {
  const [catalog, setCatalog] = useState({ categories: [], productsByCategory: {} });
  const [category, setCategory] = useState('');
  const [product, setProduct] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [inventory, setInventory] = useState(100);
  const [discount, setDiscount] = useState(5);
  const [promotion, setPromotion] = useState('None');
  const [competitorPrice, setCompetitorPrice] = useState('');
  const [region, setRegion] = useState('West');
  const [customerType, setCustomerType] = useState('Retail');
  const [objective, setObjective] = useState('Demand');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/api/catalog`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()).then(data => {
      setCatalog(data);
      const firstCategory = data.categories?.[0] || '';
      setCategory(firstCategory);
    }).catch(() => setError('Backend is not running. Start Flask on port 5000.'));
  }, [token]);

  const categoryProducts = useMemo(() => catalog.productsByCategory?.[category] || [], [catalog, category]);

  useEffect(() => {
    const p = categoryProducts[0];
    if (!p) return;
    setProduct(p);
    setCurrentPrice(p.currentPrice);
    setCompetitorPrice('');
    setResult(null);
  }, [category, categoryProducts]);

  const chooseCategory = e => setCategory(e.target.value);
  const chooseProduct = e => {
    const p = categoryProducts.find(x => String(x.id) === e.target.value);
    if (p) {
      setProduct(p); setCurrentPrice(p.currentPrice); setCompetitorPrice(''); setResult(null);
    }
  };

  const analyze = async () => {
    if (!product) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const response = await fetch(`${API}/api/optimize-price`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category, productId: product.id, product: product.name, discount,
          promotion, competitorPrice, region, customerType, objective, basePrice: product.basePrice, unitCost: product.unitCost })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Optimization failed');
      setResult(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-slate-900">Dynamic Price Optimization</h1><p className="mt-1 text-sm text-slate-500">Recommendations prioritize sell-through by default and consider stock, discount, promotion and optional competitor price. Competitor prices are never auto-invented.</p></div>

    {user?.role === 'retailer' && catalog.categories.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your product catalog is empty. Open <b>My Products & Approvals</b> to add products or import a CSV before optimizing prices.</div>}
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-6 flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-3 text-blue-600"><Target size={22}/></div><div><h2 className="font-semibold">Pricing Inputs</h2><p className="text-sm text-slate-500">Category → Product → historical baseline + clearly disclosed scenario.</p></div></div>
      <div className="grid gap-5 p-6 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Category"><select value={category} onChange={chooseCategory} className="input">{catalog.categories.map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Product"><select value={product?.name || ''} onChange={chooseProduct} className="input">{categoryProducts.map(p=><option key={p.id}>{p.name}</option>)}</select></Field>
        <Field label="Current Price (₹)"><input className="input" type="number" value={currentPrice} onChange={e=>setCurrentPrice(Number(e.target.value))}/></Field>
        <Field label="Inventory"><div className="relative"><Package size={17} className="icon"/><input className="input pl-9" type="number" value={inventory} onChange={e=>setInventory(Number(e.target.value))}/></div></Field>
        <Field label={`Discount (${discount}%)`}><div className="relative"><Percent size={17} className="icon"/><input className="input pl-9" type="number" min="0" max="100" value={discount} onChange={e=>setDiscount(Number(e.target.value))}/></div></Field>
        <Field label="Competitor Price (₹)"><input className="input" type="number" min="0" placeholder="Optional — enter actual price" value={competitorPrice} onChange={e=>setCompetitorPrice(e.target.value)}/></Field>
        <Field label="Promotion"><select className="input" value={promotion} onChange={e=>setPromotion(e.target.value)}><option>None</option><option>Black Friday</option><option>Bundle Offer</option><option>Free Shipping</option><option>Save 10%</option><option>FOODIE10</option></select></Field>
        <Field label="Region"><div className="relative"><MapPin size={17} className="icon"/><input className="input pl-9" value={region} onChange={e=>setRegion(e.target.value)}/></div></Field>
        <Field label="Customer Type"><div className="relative"><Users size={17} className="icon"/><input className="input pl-9" value={customerType} onChange={e=>setCustomerType(e.target.value)}/></div></Field>
        <Field label="Optimization Objective"><select className="input" value={objective} onChange={e=>setObjective(e.target.value)}><option>Profit</option><option>Revenue</option><option>Demand</option></select></Field>
      </div>
      <div className="border-t border-slate-200 p-6"><button onClick={analyze} disabled={loading || !product} className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{loading?<Loader2 className="animate-spin" size={18}/>:<Sparkles size={18}/>} {loading?'Evaluating price scenarios...':'Find Sell-Through Price'}</button>{error&&<div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}</div>
    </div>

    {result && <div className="grid gap-5 lg:grid-cols-4">
      <ResultCard title="Recommended Price" value={`₹${result.recommendedPrice.toLocaleString('en-IN')}`} highlight/>
      <ResultCard title="Predicted Demand" value={result.predictedDemand}/>
      <ResultCard title="Expected Revenue" value={`₹${result.expectedRevenue.toLocaleString('en-IN')}`}/>
      <ResultCard title="Expected Profit" value={`₹${result.expectedProfit.toLocaleString('en-IN')}`}/>
      {result.approvalRequired && <div className="lg:col-span-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>Approval required.</b> Recommendation #{result.recommendationId} is saved as pending. It will not update your product price until you approve it in “My Products & Approvals”. Approval updates this local app record only; it does not change an external storefront.</div>}
      <div className="lg:col-span-4 rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
        <div><b>{result.category}</b> → <b>{result.product}</b> → <b>{result.model}</b></div>
        <p className="mt-2">Demand is estimated from this product’s own historical average transaction quantity plus an explicit price-response assumption (elasticity {result.optimizationDiagnostics?.elasticityAssumption}). This is a comparative scenario, not a trained causal or competitor-aware forecast; validate with real conversion and competitor-price data before automated deployment.</p>
        <p className="mt-2">Evaluated {result.optimizationDiagnostics?.candidateCount} prices from ₹{Number(result.optimizationDiagnostics?.minCandidatePrice).toLocaleString('en-IN')} to ₹{Number(result.optimizationDiagnostics?.maxCandidatePrice).toLocaleString('en-IN')}. Objective: {result.objective}. Competitor price: {competitorPrice !== '' && Number(competitorPrice) > 0 ? `₹${Number(competitorPrice).toLocaleString('en-IN')}` : 'not supplied'}.</p>
      </div>
      <div className="lg:col-span-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4"><h3 className="font-semibold">Price candidates comparison</h3><p className="text-sm text-slate-500">Sorted by {result.objective.toLowerCase()}; compare the actual candidate outcomes.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Price</th><th className="p-3">Expected demand</th><th className="p-3">Revenue</th><th className="p-3">Profit</th><th className="p-3">Demand basis</th></tr></thead>
          <tbody>{[...result.candidates].sort((a,b)=>{const k={Profit:'expectedProfit',Revenue:'expectedRevenue',Demand:'predictedDemand'}[result.objective];return b[k]-a[k];}).slice(0,8).map((c,i)=><tr key={c.price} className={c.price===result.recommendedPrice?'bg-blue-50 font-semibold':''}><td className="p-3">₹{Number(c.price).toLocaleString('en-IN')}{c.price===result.recommendedPrice?' ★':''}</td><td className="p-3">{c.predictedDemand}</td><td className="p-3">₹{Number(c.expectedRevenue).toLocaleString('en-IN')}</td><td className="p-3">₹{Number(c.expectedProfit).toLocaleString('en-IN')}</td><td className="p-3">{c.demandSource || 'Tenant sales history'}</td></tr>)}</tbody>
        </table></div>
      </div>
    </div>}
    <style>{`.input{width:100%;border:1px solid #cbd5e1;border-radius:.75rem;background:white;padding:.75rem 1rem;font-size:.875rem;outline:none}.input:focus{border-color:#3b82f6}.icon{position:absolute;left:.75rem;top:.75rem;color:#94a3b8}`}</style>
  </div>;
}
function Field({label,children}){return <div><label className="mb-2 block text-sm font-medium text-slate-700">{label}</label>{children}</div>}
function ResultCard({title,value,highlight}){return <div className={`rounded-2xl border p-5 shadow-sm ${highlight?'border-blue-200 bg-blue-50':'border-slate-200 bg-white'}`}><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p></div>}
