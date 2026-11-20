import { useState } from "react";
import Members from "./components/Members";
import Contributions from "./components/Contributions";
import MemberFinancialStatement from "./components/MemberFinancialStatement";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Percent,
  AlertTriangle,
  HandCoins,
  FileBarChart,
  Settings,
  Bell,
  ArrowUpRight,
  CalendarDays,
  Menu,
  X,
  Clock,
  CircleDollarSign,
  Receipt,
  ChevronRight,
  LogOut
} from "lucide-react";

import "./App.css";

const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Members", icon: Users },
  { name: "Contributions", icon: Wallet },
  { name: "Interest", icon: Percent },
  { name: "Fines", icon: AlertTriangle },
  { name: "Loans", icon: HandCoins },
  { name: "Reports", icon: FileBarChart },
  { name: "Settings", icon: Settings }
];

const statistics = [
  {
    title: "Total Members",
    value: "24",
    description: "Registered members",
    icon: Users,
    color: "blue"
  },
  {
    title: "Total Savings",
    value: "R52,800",
    description: "Accumulated contributions",
    icon: Wallet,
    color: "green"
  },
  {
    title: "Interest Collected",
    value: "R13,200",
    description: "Monthly interest contributions",
    icon: Percent,
    color: "purple"
  },
  {
    title: "Outstanding Fines",
    value: "R1,250",
    description: "Unpaid fines",
    icon: AlertTriangle,
    color: "orange"
  }
];

const transactions = [
  {
    member: "Thabo Mokoena",
    type: "Monthly Contribution",
    date: "02 Nov 2026",
    amount: "R200",
    status: "Paid"
  },
  {
    member: "Lerato Nkosi",
    type: "Interest Contribution",
    date: "02 Nov 2026",
    amount: "R50",
    status: "Paid"
  },
  {
    member: "Kabelo Maseko",
    type: "Meeting Fine",
    date: "01 Nov 2026",
    amount: "R50",
    status: "Outstanding"
  },
  {
    member: "Mpho Dlamini",
    type: "Loan Repayment",
    date: "01 Nov 2026",
    amount: "R500",
    status: "Paid"
  }
];

const months = [
  { name: "Feb", value: 75 },
  { name: "Mar", value: 90 },
  { name: "Apr", value: 65 },
  { name: "May", value: 85 },
  { name: "Jun", value: 70 },
  { name: "Jul", value: 95 },
  { name: "Aug", value: 80 },
  { name: "Sep", value: 90 },
  { name: "Oct", value: 75 },
  { name: "Nov", value: 95 },
  { name: "Dec", value: 0 }
];

function App({ profile, onSignOut }) {
  const [activePage, setActivePage] = useState("Overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const selectedNavigation = navigation.find(
    (item) => item.name === activePage
  );

  const PageIcon = selectedNavigation.icon;

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

            <button className="notification-button" aria-label="Notifications">
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
                <strong>{profile?.full_name || "Administrator"}</strong>
                <span>{profile?.email}</span>
              </div>
            </div>

          </div>

        </header>

        <div className="page-content">

          {activePage === "Overview" ? (

            <>

              {/* Dashboard heading */}
              <section className="page-heading">

                <div>
                  <span className="eyebrow">FINANCIAL MANAGEMENT</span>
                  <h1>Dashboard Overview</h1>
                  <p>
                    Welcome to the 0190 Social Club management portal.
                  </p>
                </div>

                <div className="cycle-badge">
                  <CalendarDays size={17} />
                  February – December Cycle
                </div>

              </section>

              {/* Demo notice */}
              <div className="demo-notice">
                <Bell size={17} />
                <span>
                  Preview mode: All financial figures and transactions
                  displayed are illustrative sample data.
                </span>
              </div>

              {/* Statistics */}
              <section className="statistics-grid">

                {statistics.map((stat) => {
                  const Icon = stat.icon;

                  return (
                    <div className="stat-card" key={stat.title}>

                      <div className={`stat-icon ${stat.color}`}>
                        <Icon size={22} />
                      </div>

                      <span className="stat-title">{stat.title}</span>

                      <h2>{stat.value}</h2>

                      <span className="stat-description">
                        {stat.description}
                      </span>

                    </div>
                  );
                })}

              </section>

              {/* Dashboard grid */}
              <section className="dashboard-grid">

                {/* Contributions chart */}
                <div className="panel contribution-panel">

                  <div className="panel-header">

                    <div>
                      <h3>Monthly Contributions</h3>
                      <p>Contribution activity throughout the year</p>
                    </div>

                    <button className="period-button">
                      <CalendarDays size={16} />
                      Annual
                    </button>

                  </div>

                  <div className="chart-area">

                    <div className="chart-bars">

                      {months.map((month) => (

                        <div className="chart-column" key={month.name}>

                          <div className="bar-container">

                            <div
                              className={`bar-fill ${
                                month.name === "Nov" ? "highlight" : ""
                              }`}
                              style={{ height: `${month.value}%` }}
                            />

                          </div>

                          <span>{month.name}</span>

                        </div>

                      ))}

                    </div>

                  </div>

                  <div className="chart-legend">
                    <span className="legend-dot" />
                    Monthly contribution activity
                  </div>

                </div>

                {/* Year-end summary */}
                <div className="panel year-panel">

                  <div className="panel-header">
                    <div>
                      <h3>Year-End Summary</h3>
                      <p>Club financial targets</p>
                    </div>

                    <CircleDollarSign size={21} />
                  </div>

                  <div className="target-item">
                    <span>Minimum savings target</span>
                    <strong>R4,000</strong>
                    <small>Per member annually</small>
                  </div>

                  <div className="target-divider" />

                  <div className="target-item">
                    <span>Annual loan target</span>
                    <strong>R1,500</strong>
                    <small>Compulsory loan target</small>
                  </div>

                  <div className="target-divider" />

                  <div className="payout-info">
                    <CalendarDays size={20} />
                    <div>
                      <strong>Annual Payout</strong>
                      <span>Second week of December</span>
                    </div>
                  </div>

                </div>

              </section>

              {/* Recent Transactions */}
              <section className="panel transactions-panel">

                <div className="panel-header">

                  <div>
                    <h3>Recent Transactions</h3>
                    <p>Latest financial activities recorded</p>
                  </div>

                  <button className="view-all-button">
                    View all
                    <ArrowUpRight size={16} />
                  </button>

                </div>

                <div className="table-wrapper">

                  <table>

                    <thead>
                      <tr>
                        <th>MEMBER</th>
                        <th>TRANSACTION TYPE</th>
                        <th>DATE</th>
                        <th>AMOUNT</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>

                    <tbody>

                      {transactions.map((transaction, index) => (

                        <tr key={index}>

                          <td>
                            <div className="member-cell">
                              <div className="member-avatar">
                                {transaction.member
                                  .split(" ")
                                  .map((word) => word[0])
                                  .join("")}
                              </div>

                              <strong>{transaction.member}</strong>
                            </div>
                          </td>

                          <td>{transaction.type}</td>

                          <td>{transaction.date}</td>

                          <td className="amount-cell">
                            {transaction.amount}
                          </td>

                          <td>
                            <span
                              className={`status ${
                                transaction.status === "Paid"
                                  ? "paid"
                                  : "outstanding"
                              }`}
                            >
                              {transaction.status}
                            </span>
                          </td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

              </section>

              {/* Upcoming activities */}
              <section className="bottom-grid">

                <div className="panel activity-card">

                  <div className="activity-icon">
                    <Clock size={22} />
                  </div>

                  <div>
                    <h3>Monthly Club Meetings</h3>
                    <p>First Sunday of every month at 15:00.</p>
                  </div>

                </div>

                <div className="panel activity-card">

                  <div className="activity-icon green">
                    <Receipt size={22} />
                  </div>

                  <div>
                    <h3>Banking Contributions</h3>
                    <p>Monday to Wednesday following the meeting.</p>
                  </div>

                </div>

              </section>

            </>

          ) : activePage === "Members" ? (

            <Members />

          ) : activePage === "Contributions" ? (

            <Contributions />

          ) : activePage === "Reports" ? (

            <MemberFinancialStatement />

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

          <footer className="page-footer">
            <span>0190 Social Club © 2026</span>
            <span>Financial Management Portal</span>
          </footer>

        </div>

      </main>

    </div>
  );
}

export default App;