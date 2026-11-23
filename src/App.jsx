
import { useEffect, useState } from "react";

import Members from "./components/Members";
import Contributions from "./components/Contributions";
import MemberFinancialStatement from "./components/MemberFinancialStatement";
import Fines from "./components/Fines";
import Loans from "./components/Loans";
import Overview from "./components/Overview";
import AnnualReports from "./components/AnnualReports";

import {
  LayoutDashboard,
  Users,
  Wallet,
  AlertTriangle,
  HandCoins,
  FileBarChart,
  BarChart3,
  Bell,
  Menu,
  X,
  CircleDollarSign,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";

import "./App.css";

const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Members", icon: Users },
  { name: "Contributions", icon: Wallet },
  { name: "Fines", icon: AlertTriangle },
  { name: "Loans", icon: HandCoins },
  { name: "Reports", icon: FileBarChart },
  { name: "Annual Reports", icon: BarChart3 },
];

function getInitialTheme() {
  try {
    const savedTheme = localStorage.getItem("0190-theme");
    return savedTheme === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function App({ profile, onSignOut }) {
  const [activePage, setActivePage] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);

    try {
      localStorage.setItem("0190-theme", theme);
    } catch {
      // Theme still works for the current session if storage is unavailable.
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) =>
      currentTheme === "light" ? "dark" : "light"
    );
  };

  const selectedNavigation = navigation.find(
    (item) => item.name === activePage
  );

  const PageIcon = selectedNavigation?.icon || LayoutDashboard;

  return (
    <div className="app-shell">

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>

        <div className="brand">
          <div className="brand-logo">0190</div>

          <div className="brand-text">
            <h2>0190</h2>
            <span>Social Club</span>
          </div>

          <button
            className="close-sidebar"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-label">MAIN MENU</div>

        <nav className="navigation">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                className={`nav-link ${
                  activePage === item.name ? "active" : ""
                }`}
                onClick={() => {
                  setActivePage(item.name);
                  setSidebarOpen(false);
                }}
              >
                <Icon size={19} />
                <span>{item.name}</span>

                {activePage === item.name && (
                  <ChevronRight size={16} className="nav-arrow" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="footer-icon">
            <CircleDollarSign size={22} />
          </div>

          <h4>Financial Year</h4>
          <p>February – December</p>
          <span>0190 Social Club</span>
        </div>

      </aside>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="main-area">

        {/* Top navigation */}
        <header className="topbar">

          <div className="topbar-left">
            <button
              className="menu-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu size={23} />
            </button>

            <div>
              <span className="breadcrumb">0190 Social Club</span>
              <span className="breadcrumb-divider">/</span>
              <strong>{activePage}</strong>
            </div>
          </div>

          <div className="topbar-right">

            <span className="admin-badge">ADMINISTRATOR</span>

            {/* Theme switcher */}
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
              type="button"
            >
              {theme === "light" ? (
                <Moon size={19} />
              ) : (
                <Sun size={19} />
              )}
            </button>

            <button
              className="notification-button"
              aria-label="Notifications"
            >
              <Bell size={20} />
              <span className="notification-dot" />
            </button>

            <button
              className="sign-out-button"
              onClick={onSignOut}
            >
              <LogOut size={17} />
              Sign out
            </button>

            <div className="profile">
              <div className="profile-avatar">
                {(profile?.full_name || "AD")
                  .split(" ")
                  .map((word) => word[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div className="profile-details">
                <strong>
                  {profile?.full_name || "Administrator"}
                </strong>
                <span>{profile?.email}</span>
              </div>
            </div>

          </div>
        </header>

        {/* Page content */}
        <div className="page-content">

          {activePage === "Overview" ? (

            <Overview />

          ) : activePage === "Members" ? (

            <Members />

          ) : activePage === "Contributions" ? (

            <Contributions />

          ) : activePage === "Fines" ? (

            <Fines />

          ) : activePage === "Loans" ? (

            <Loans />

          ) : activePage === "Reports" ? (

            <MemberFinancialStatement />

          ) : activePage === "Annual Reports" ? (

            <AnnualReports />

          ) : (

            <section className="module-placeholder">
              <div className="placeholder-icon">
                <PageIcon size={36} />
              </div>

              <h2>{activePage}</h2>

              <p>
                The {activePage.toLowerCase()} module will be developed
                as we progress with the 0190 Social Club application.
              </p>

              <span>Module not yet implemented</span>
            </section>

          )}

          {/* Footer */}
          <footer className="page-footer">
            <span>
              0190 Social Club © {new Date().getFullYear()}
            </span>

            <span>Financial Management Portal</span>
          </footer>

        </div>
      </main>
    </div>
  );
}

export default App;
