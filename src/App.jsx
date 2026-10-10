import { useEffect, useState } from "react";

import PriceOptimization from "./pages/PriceOptimization";
import WhatIfAnalysis from "./pages/WhatIfAnalysis";
import Inventory from "./pages/Inventory";
import Analytics from "./pages/Analytics";
import AccountWorkspace from "./pages/AccountWorkspace";

import AuthGate from "./AuthGate";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import WorkspaceDashboard from "./pages/WorkspaceDashboard";

const API = "http://127.0.0.1:5000";

function App() {
  const [activePage, setActivePage] = useState("dashboard");

  // Each browser tab maintains its own login token.
  const [token, setToken] = useState(
    () => sessionStorage.getItem("rpo_token") || ""
  );

  const [user, setUser] = useState(null);

  const [checking, setChecking] = useState(
    () => Boolean(sessionStorage.getItem("rpo_token"))
  );

  useEffect(() => {
    if (!token) {
      setUser(null);
      setChecking(false);
      return;
    }

    let cancelled = false;

    async function verifySession() {
      setChecking(true);

      try {
        const response = await fetch(`${API}/api/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Session expired.");
        }

        if (!cancelled) {
          setUser(data);
        }
      } catch (error) {
        if (!cancelled) {
          sessionStorage.removeItem("rpo_token");
          setToken("");
          setUser(null);
          setActivePage("dashboard");
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    verifySession();

    return () => {
      cancelled = true;
    };
  }, [token]);

  function onLogin(newToken, newUser) {
    sessionStorage.setItem("rpo_token", newToken);

    setToken(newToken);
    setUser(newUser);
    setChecking(false);
    setActivePage("dashboard");
  }

  async function logout() {
    const currentToken = token;

    sessionStorage.removeItem("rpo_token");
    setToken("");
    setUser(null);
    setActivePage("dashboard");
    setChecking(false);

    try {
      if (currentToken) {
        await fetch(`${API}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });
      }
    } catch (error) {
      console.error("Logout request failed:", error);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">
          Checking session...
        </div>
      </div>
    );
  }

  if (!token || !user) {
    return <AuthGate onLogin={onLogin} />;
  }

  const isAdmin = user.role === "admin";

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        user={user}
      />

      <div className="ml-64 min-h-screen">
        <Topbar user={user} onLogout={logout} />

        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          {activePage === "dashboard" && (
            <WorkspaceDashboard
              token={token}
              user={user}
              onNavigate={setActivePage}
            />
          )}

          {/* Accounts workspace: retailer and admin */}
          {activePage === "accounts" && (
            <AccountWorkspace
              token={token}
              user={user}
            />
          )}

          {!isAdmin && activePage === "optimization" && (
            <PriceOptimization
              token={token}
              user={user}
            />
          )}

          {!isAdmin && activePage === "whatif" && (
            <WhatIfAnalysis token={token} />
          )}

          {!isAdmin && activePage === "inventory" && (
            <Inventory token={token} />
          )}

          {!isAdmin && activePage === "analytics" && (
            <Analytics token={token} />
          )}

          {/* Fallback for an unknown page key */}
          {![
            "dashboard",
            "accounts",
            "optimization",
            "whatif",
            "inventory",
            "analytics",
          ].includes(activePage) && (
            <section className="rounded-2xl border border-slate-200 bg-white p-8">
              <h2 className="text-lg font-bold text-slate-900">
                Page not found
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Please select a page from the sidebar.
              </p>
              <button
                type="button"
                onClick={() => setActivePage("dashboard")}
                className="mt-4 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Back to dashboard
              </button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;