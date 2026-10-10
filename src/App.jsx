
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
  const [token, setToken] = useState(
    () => localStorage.getItem("rpo_token") || ""
  );
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(
    Boolean(localStorage.getItem("rpo_token"))
  );

  useEffect(() => {
    if (!token) {
      setUser(null);
      setChecking(false);
      return;
    }

    let cancelled = false;

    fetch(`${API}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Session expired");
        }
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem("rpo_token");
          setToken("");
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  function onLogin(newToken, newUser) {
    localStorage.setItem("rpo_token", newToken);
    setToken(newToken);
    setUser(newUser);
    setChecking(false);
    setActivePage("dashboard");
  }

  async function logout() {
    try {
      await fetch(`${API}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      console.error("Logout request failed:", error);
    }

    localStorage.removeItem("rpo_token");
    setToken("");
    setUser(null);
    setActivePage("dashboard");
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Checking session…
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

          {activePage === "accounts" && (
            <AccountWorkspace token={token} user={user} />
          )}

          {!isAdmin && activePage === "optimization" && (
            <PriceOptimization token={token} user={user} />
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
        </main>
      </div>
    </div>
  );
}

export default App;
