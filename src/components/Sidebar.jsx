
import {
  LayoutDashboard,
  Tag,
  FlaskConical,
  Package,
  BarChart3,
  Brain,
  Users,
  ClipboardList,
} from "lucide-react";

const retailerItems = [
  { name: "Overview", icon: LayoutDashboard, page: "dashboard" },
  { name: "Products & Data Import", icon: Package, page: "accounts" },
  { name: "Price Optimization", icon: Tag, page: "optimization" },
  { name: "What-If Lab", icon: FlaskConical, page: "whatif" },
  { name: "Inventory", icon: ClipboardList, page: "inventory" },
  { name: "Analytics", icon: BarChart3, page: "analytics" },
];

const adminItems = [
  { name: "Admin Overview", icon: LayoutDashboard, page: "dashboard" },
  { name: "Retailer Accounts", icon: Users, page: "accounts" },
];

export default function Sidebar({ activePage, setActivePage, user }) {
  const isAdmin = user?.role === "admin";
  const items = isAdmin ? adminItems : retailerItems;

  return (
    <aside className="fixed left-0 top-0 z-20 flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-20 shrink-0 items-center gap-3 border-b border-slate-200 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Brain size={22} />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-900">RetailAI</h1>
          <p className="text-xs text-slate-500">
            {isAdmin ? "Platform administration" : "Your shop workspace"}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          {isAdmin ? "Administration" : "Shop workspace"}
        </p>

        {items.map(({ name, icon: Icon, page }) => (
          <button
            key={page}
            onClick={() => setActivePage(page)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
              activePage === page
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Icon size={19} />
            {name}
          </button>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="truncate text-sm font-semibold text-slate-800">
            {user?.displayName || user?.username}
          </p>
          <p className="mt-1 text-xs capitalize text-slate-500">
            {user?.role} account
          </p>
        </div>
      </div>
    </aside>
  );
}
