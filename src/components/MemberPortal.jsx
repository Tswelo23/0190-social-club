import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  FileText,
  Wallet,
  AlertTriangle,
  HandCoins,
  Printer,
  LogOut,
  LoaderCircle,
  UserRound,
  CalendarDays,
  Download,
  Sun,
  Moon,
  Menu,
  X,
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Percent,
  Landmark,
  Receipt,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import "./MemberPortal.css";

/* =========================================
   HELPERS
   ========================================= */

const currency = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
});

const money = (value) => currency.format(Number(value || 0));

const compactMoney = (value) => {
  const n = Number(value || 0);
  if (n >= 1000) return `R${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `R${Math.round(n)}`;
};

const num = (value) => Number(value || 0);
const sum = (rows, key) => rows.reduce((total, row) => total + num(row[key]), 0);

const toIso = (date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

const parseDate = (value) => new Date(`${value}T00:00:00`);

const dateLabel = (value) =>
  value ? parseDate(value).toLocaleDateString("en-ZA") : "—";

const longDate = (value) =>
  parseDate(value).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const inRange = (date, range) =>
  Boolean(date) && date >= range.start && date < range.end;

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

/* The club's financial year runs February to January */

const months = [
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "January",
];

const FIRST_FINANCIAL_YEAR = 2026;

const getCurrentFinancialYear = () => {
  const now = new Date();
  return now.getMonth() >= 1 ? now.getFullYear() : now.getFullYear() - 1;
};

const CURRENT_FY = getCurrentFinancialYear();
const CURRENT_MONTH = months[(new Date().getMonth() + 11) % 12];

const financialYears = Array.from(
  { length: Math.max(CURRENT_FY + 1, 2028) - FIRST_FINANCIAL_YEAR + 1 },
  (_, index) => FIRST_FINANCIAL_YEAR + index
);

const getMonthRange = (month, financialYear) => {
  const calendarMonth = (months.indexOf(month) + 1) % 12;
  const year = calendarMonth === 0 ? financialYear + 1 : financialYear;

  return {
    start: toIso(new Date(year, calendarMonth, 1)),
    end: toIso(new Date(year, calendarMonth + 1, 1)),
  };
};

const getPeriodRange = (period, month, year) =>
  period === "monthly"
    ? getMonthRange(month, year)
    : { start: `${year}-02-01`, end: `${year + 1}-02-01` };

const getPreviousRange = (period, month, year) => {
  if (period === "annual") return getPeriodRange("annual", month, year - 1);

  const index = months.indexOf(month);
  return index === 0
    ? getMonthRange("January", year - 1)
    : getMonthRange(months[index - 1], year);
};

/* Status labels and pills */

const statusInfo = (status, kind) => {
  const loan = kind === "loan";
  if (status === "paid")
    return { label: loan ? "Fully repaid" : "Paid", tone: "success" };
  if (status === "partially_paid")
    return {
      label: loan ? "Partially repaid" : "Partially paid",
      tone: "warning",
    };
  return { label: loan ? "Outstanding" : "Unpaid", tone: "danger" };
};

const statusPill = (status, kind) => {
  const { label, tone } = statusInfo(status, kind);
  return <span className={`mp-pill ${tone}`}>{label}</span>;
};

/* Nice round axis maximum for the chart */

const AXIS_STEPS = 5;

const niceCeil = (value) => {
  if (value <= 0) return 100;
  const exponent = Math.pow(10, Math.floor(Math.log10(value)));
  const fraction = value / exponent;
  const options = [1, 1.5, 2, 2.5, 4, 5, 7.5, 10];
  const pick = options.find((option) => fraction <= option + 1e-9) || 10;
  return pick * exponent;
};

/* CSV download */

const cellText = (cell) => (cell && cell.props ? cell.props.children : cell);

const downloadCsv = (filename, headers, rows) => {
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows]
    .map((row) => row.map(escape).join(","))
    .join("\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const EMPTY_DATA = {
  contributions: [],
  fines: [],
  loans: [],
  finePayments: [],
  loanRepayments: [],
};

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem("mp-theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    /* storage unavailable */
  }

  const appTheme = document.documentElement.getAttribute("data-theme");
  if (appTheme === "dark" || appTheme === "light") return appTheme;

  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

/* =========================================
   MAIN PORTAL
   ========================================= */

export default function MemberPortal({ profile, onSignOut }) {
  const [activePage, setActivePage] = useState("Dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);

  const [period, setPeriod] = useState("annual");
  const [selectedYear, setSelectedYear] = useState(CURRENT_FY);
  const [selectedMonth, setSelectedMonth] = useState(CURRENT_MONTH);

  const [chartMode, setChartMode] = useState("bars");
  const [activityFilter, setActivityFilter] = useState("all");
  const [showAllActivity, setShowAllActivity] = useState(false);

  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const memberId = profile?.id;
  const firstName = (profile?.full_name || "Member").split(" ")[0];

  /* ---------- theme ---------- */

  useEffect(() => {
    try {
      localStorage.setItem("mp-theme", theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  // Follow the app's own theme switch if it changes <html data-theme="...">
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      const value = root.getAttribute("data-theme");
      if (value === "dark" || value === "light") setTheme(value);
    });
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  /* ---------- periods ---------- */

  const range = useMemo(
    () => getPeriodRange(period, selectedMonth, selectedYear),
    [period, selectedMonth, selectedYear]
  );

  const previousRange = useMemo(
    () => getPreviousRange(period, selectedMonth, selectedYear),
    [period, selectedMonth, selectedYear]
  );

  /* ---------- load every record once; filter in the browser ---------- */

  useEffect(() => {
    if (!memberId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const [contributionRes, fineRes, loanRes] = await Promise.all([
          supabase
            .from("contributions")
            .select("id, amount, interest_contribution, contribution_date, notes")
            .eq("member_id", memberId)
            .order("contribution_date", { ascending: false }),

          supabase
            .from("fine_balances")
            .select("*")
            .eq("member_id", memberId)
            .order("fine_date", { ascending: false }),

          supabase
            .from("loan_balances")
            .select("*")
            .eq("member_id", memberId)
            .order("loan_date", { ascending: false }),
        ]);

        for (const result of [contributionRes, fineRes, loanRes]) {
          if (result.error) throw result.error;
        }

        const fines = fineRes.data || [];
        const loans = loanRes.data || [];
        const fineIds = fines.map((fine) => fine.fine_id);
        const loanIds = loans.map((loan) => loan.loan_id);

        const [finePaymentRes, loanRepaymentRes] = await Promise.all([
          fineIds.length
            ? supabase
                .from("fine_payments")
                .select("id, fine_id, amount, payment_date, notes")
                .in("fine_id", fineIds)
                .order("payment_date", { ascending: false })
            : Promise.resolve({ data: [], error: null }),

          loanIds.length
            ? supabase
                .from("loan_repayments")
                .select("id, loan_id, amount, payment_date, notes")
                .in("loan_id", loanIds)
                .order("payment_date", { ascending: false })
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (finePaymentRes.error) throw finePaymentRes.error;
        if (loanRepaymentRes.error) throw loanRepaymentRes.error;

        if (cancelled) return;

        setData({
          contributions: contributionRes.data || [],
          fines,
          loans,
          finePayments: finePaymentRes.data || [],
          loanRepayments: loanRepaymentRes.data || [],
        });
      } catch (err) {
        console.error("Member portal data error:", err);
        if (!cancelled) {
          setError(err.message || "Unable to load your financial records.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [memberId, reloadKey]);

  /* ---------- records inside the selected period ---------- */

  const { contributions, fines, loans, finePayments, loanRepayments } =
    useMemo(() => {
      const within = (rows, field) =>
        rows.filter((row) => inRange(row[field], range));

      return {
        contributions: within(data.contributions, "contribution_date"),
        fines: within(data.fines, "fine_date"),
        loans: within(data.loans, "loan_date"),
        finePayments: within(data.finePayments, "payment_date"),
        loanRepayments: within(data.loanRepayments, "payment_date"),
      };
    }, [data, range]);

  /* ---------- totals ---------- */

  const totals = useMemo(() => {
    const savings = sum(contributions, "amount");
    const interest = sum(contributions, "interest_contribution");

    return {
      savings,
      interest,
      contributed: savings + interest,
      finesIssued: sum(fines, "fine_amount"),
      finesPaidOn: sum(fines, "total_paid"),
      outstandingFines: sum(fines, "outstanding_balance"),
      repayable: sum(loans, "total_repayable"),
      loansRepaid: sum(loans, "total_repaid"),
      outstandingLoans: sum(loans, "outstanding_balance"),
      principal: sum(loans, "principal_amount"),
      interestCharged: sum(loans, "interest_amount"),
      finePayments: sum(finePayments, "amount"),
      loanPayments: sum(loanRepayments, "amount"),
    };
  }, [contributions, fines, loans, finePayments, loanRepayments]);

  const previous = useMemo(() => {
    const rows = data.contributions.filter((row) =>
      inRange(row.contribution_date, previousRange)
    );
    const savings = sum(rows, "amount");
    const interest = sum(rows, "interest_contribution");
    return { savings, interest, contributed: savings + interest };
  }, [data.contributions, previousRange]);

  const lifetime = useMemo(
    () => ({
      savings: sum(data.contributions, "amount"),
      interest: sum(data.contributions, "interest_contribution"),
      outstandingFines: sum(data.fines, "outstanding_balance"),
      outstandingLoans: sum(data.loans, "outstanding_balance"),
    }),
    [data]
  );

  const vsLabel = period === "annual" ? "vs last year" : "vs last month";

  /* ---------- chart data ---------- */

  const chartData = useMemo(() => {
    const buckets = new Map();

    if (period === "annual") {
      for (let index = 0; index < 12; index++) {
        const date = new Date(selectedYear, index + 1, 1);
        const key = toIso(date);

        buckets.set(key, {
          key,
          label: date.toLocaleDateString("en-ZA", { month: "short" }),
          full: date.toLocaleDateString("en-ZA", {
            month: "long",
            year: "numeric",
          }),
          showLabel: true,
          savings: 0,
          interest: 0,
        });
      }
    } else {
      const end = parseDate(range.end);

      for (
        const date = parseDate(range.start);
        date < end;
        date.setDate(date.getDate() + 1)
      ) {
        const key = toIso(date);
        const day = date.getDate();

        buckets.set(key, {
          key,
          label: String(day),
          full: longDate(key),
          showLabel: day === 1 || day % 5 === 0,
          savings: 0,
          interest: 0,
        });
      }
    }

    contributions.forEach((item) => {
      const key =
        period === "annual"
          ? `${item.contribution_date.slice(0, 7)}-01`
          : item.contribution_date;

      const bucket = buckets.get(key);

      if (bucket) {
        bucket.savings += num(item.amount);
        bucket.interest += num(item.interest_contribution);
      }
    });

    let running = 0;

    return Array.from(buckets.values()).map((bucket) => {
      const total = bucket.savings + bucket.interest;
      running += total;
      return { ...bucket, total, cumulative: running };
    });
  }, [contributions, period, selectedYear, range]);

  /* ---------- activity feed ---------- */

  const activity = useMemo(() => {
    const items = [
      ...contributions.map((item) => ({
        id: `contribution-${item.id}`,
        title: "Contribution recorded",
        detail: item.notes || "Savings and interest contribution",
        date: item.contribution_date,
        amount: num(item.amount) + num(item.interest_contribution),
        type: "contribution",
      })),
      ...fines.map((item) => ({
        id: `fine-${item.fine_id}`,
        title: "Fine issued",
        detail: item.reason || "Club fine",
        date: item.fine_date,
        amount: num(item.fine_amount),
        type: "fine",
      })),
      ...finePayments.map((item) => ({
        id: `fine-payment-${item.id}`,
        title: "Fine payment",
        detail: item.notes || "Fine payment received",
        date: item.payment_date,
        amount: num(item.amount),
        type: "payment",
      })),
      ...loans.map((item) => ({
        id: `loan-${item.loan_id}`,
        title: "Loan issued",
        detail: "New loan",
        date: item.loan_date,
        amount: num(item.principal_amount),
        type: "loan",
      })),
      ...loanRepayments.map((item) => ({
        id: `loan-payment-${item.id}`,
        title: "Loan repayment",
        detail: item.notes || "Loan repayment recorded",
        date: item.payment_date,
        amount: num(item.amount),
        type: "payment",
      })),
    ];

    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [contributions, fines, finePayments, loans, loanRepayments]);

  const activityFilters = [
    { id: "all", label: "All" },
    { id: "contribution", label: "Contributions" },
    { id: "fine", label: "Fines" },
    { id: "loan", label: "Loans" },
    { id: "payment", label: "Payments" },
  ];

  const filteredActivity =
    activityFilter === "all"
      ? activity
      : activity.filter((item) => item.type === activityFilter);

  const visibleActivity = showAllActivity
    ? filteredActivity
    : filteredActivity.slice(0, 6);

  /* ---------- loan progress ---------- */

  const loanRepaid = Math.max(0, totals.repayable - totals.outstandingLoans);

  const loanProgress =
    totals.repayable > 0
      ? Math.min(100, (loanRepaid / totals.repayable) * 100)
      : 0;

  /* ---------- lookups use ALL records so payments always find their parent ---------- */

  const fineLookup = useMemo(
    () => new Map(data.fines.map((fine) => [fine.fine_id, fine])),
    [data.fines]
  );

  const loanLookup = useMemo(
    () => new Map(data.loans.map((loan) => [loan.loan_id, loan])),
    [data.loans]
  );

  /* ---------- labels ---------- */

  const reportTitle =
    period === "monthly"
      ? `${selectedMonth} ${
          selectedMonth === "January" ? selectedYear + 1 : selectedYear
        }`
      : `${selectedYear} Financial Year`;

  const rangeLabel = (() => {
    const last = parseDate(range.end);
    last.setDate(last.getDate() - 1);
    return `${longDate(range.start)} – ${longDate(toIso(last))}`;
  })();

  /* ---------- table rows (shared by the Statement and the record pages) ---------- */

  const contributionHeaders = ["Date", "Savings", "Interest", "Total", "Notes"];
  const contributionRows = contributions.map((item) => [
    dateLabel(item.contribution_date),
    money(item.amount),
    money(item.interest_contribution),
    money(num(item.amount) + num(item.interest_contribution)),
    item.notes || "—",
  ]);
  const contributionFooter = [
    "Total",
    money(totals.savings),
    money(totals.interest),
    money(totals.contributed),
    "",
  ];

  const fineHeaders = ["Date", "Reason", "Fine", "Paid", "Outstanding", "Status"];
  const fineRows = fines.map((fine) => [
    dateLabel(fine.fine_date),
    fine.reason || "Fine",
    money(fine.fine_amount),
    money(fine.total_paid),
    money(fine.outstanding_balance),
    statusPill(fine.payment_status, "fine"),
  ]);
  const fineFooter = [
    "Total",
    "",
    money(totals.finesIssued),
    money(totals.finesPaidOn),
    money(totals.outstandingFines),
    "",
  ];

  const finePaymentHeaders = ["Date", "Fine reason", "Amount paid", "Notes"];
  const finePaymentRows = finePayments.map((payment) => [
    dateLabel(payment.payment_date),
    fineLookup.get(payment.fine_id)?.reason || "Fine payment",
    money(payment.amount),
    payment.notes || "—",
  ]);
  const finePaymentFooter = ["Total", "", money(totals.finePayments), ""];

  const loanHeaders = [
    "Date",
    "Principal",
    "Interest",
    "Repayable",
    "Repaid",
    "Outstanding",
    "Status",
  ];
  const loanRows = loans.map((loan) => [
    dateLabel(loan.loan_date),
    money(loan.principal_amount),
    money(loan.interest_amount),
    money(loan.total_repayable),
    money(loan.total_repaid),
    money(loan.outstanding_balance),
    statusPill(loan.payment_status, "loan"),
  ]);
  const loanFooter = [
    "Total",
    money(totals.principal),
    money(totals.interestCharged),
    money(totals.repayable),
    money(totals.loansRepaid),
    money(totals.outstandingLoans),
    "",
  ];

  const loanPaymentHeaders = ["Date", "Loan date", "Amount paid", "Notes"];
  const loanPaymentRows = loanRepayments.map((payment) => [
    dateLabel(payment.payment_date),
    dateLabel(loanLookup.get(payment.loan_id)?.loan_date),
    money(payment.amount),
    payment.notes || "—",
  ]);
  const loanPaymentFooter = ["Total", "", money(totals.loanPayments), ""];

  /* ---------- navigation ---------- */

  const navigation = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Statement", icon: FileText },
    { name: "Contributions", icon: Wallet },
    { name: "Fines", icon: AlertTriangle, alert: lifetime.outstandingFines > 0 },
    { name: "Loans", icon: HandCoins, alert: lifetime.outstandingLoans > 0 },
  ];

  const goTo = (page) => {
    setActivePage(page);
    setMenuOpen(false);
  };

  /* ---------- reusable chart card (Dashboard and Contributions) ---------- */

  const chartCard = (
    <section className="mp-card mp-chart-card">
      <div className="mp-card-head">
        <div>
          <h3>Contribution trends</h3>
          <p>Savings and interest for {reportTitle}</p>
        </div>

        <div className="mp-segment small" role="group" aria-label="Chart type">
          <button
            className={chartMode === "bars" ? "active" : ""}
            onClick={() => setChartMode("bars")}
          >
            Bars
          </button>
          <button
            className={chartMode === "cumulative" ? "active" : ""}
            onClick={() => setChartMode("cumulative")}
          >
            Running total
          </button>
        </div>
      </div>

      <ContributionChart data={chartData} mode={chartMode} />

      <div className="mp-legend">
        {chartMode === "bars" ? (
          <>
            <span>
              <i className="savings" />
              Savings
            </span>
            <span>
              <i className="interest" />
              Interest
            </span>
          </>
        ) : (
          <span>
            <i className="total" />
            Running total (savings + interest)
          </span>
        )}
      </div>
    </section>
  );

  /* =========================================
     RENDER
     ========================================= */

  return (
    <div className="mp" data-mp-theme={theme}>
      {menuOpen && <div className="mp-scrim" onClick={() => setMenuOpen(false)} />}

      {/* SIDEBAR */}

      <aside className={`mp-sidebar ${menuOpen ? "open" : ""}`}>
        <div className="mp-brand">
          <div className="mp-brand-logo">0190</div>

          <div>
            <strong>0190</strong>
            <span>Social Club</span>
          </div>

          <button
            className="mp-icon-button mp-close-button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav aria-label="Member menu">
          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                className={activePage === item.name ? "active" : ""}
                onClick={() => goTo(item.name)}
                aria-current={activePage === item.name ? "page" : undefined}
              >
                <Icon size={19} />
                {item.name}
                {item.alert && (
                  <span
                    className="mp-nav-dot"
                    title="You have an outstanding balance"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="mp-sidebar-footer">
          <span>Logged in as</span>
          <strong>{profile?.full_name}</strong>
          <small>Member #{profile?.member_number || "—"}</small>

          <button onClick={onSignOut}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      {/* MAIN */}

      <main className="mp-main">
        <header className="mp-topbar">
          <button
            className="mp-icon-button mp-menu-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="mp-topbar-title">
            <span>0190 Social Club</span>
            <h1>{activePage}</h1>
          </div>

          <div className="mp-topbar-actions">
            <button
              className="mp-icon-button"
              onClick={() => setReloadKey((key) => key + 1)}
              aria-label="Refresh records"
              title="Refresh records"
            >
              <RefreshCw size={17} />
            </button>

            <button
              className="mp-icon-button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <div className="mp-topbar-profile">
              <div className="mp-avatar">
                <UserRound size={20} />
              </div>

              <div>
                <strong>{profile?.full_name}</strong>
                <span>Member</span>
              </div>
            </div>
          </div>
        </header>

        <div className="mp-content">
          {/* WELCOME */}

          {activePage === "Dashboard" && (
            <section className="mp-welcome">
              <div>
                <h2>
                  {greeting()}, {firstName}
                </h2>
                <p>Here is where your club contributions and records stand.</p>
              </div>

              <div className="mp-welcome-chips">
                <div>
                  <span>Total contributed to date</span>
                  <strong>{money(lifetime.savings + lifetime.interest)}</strong>
                </div>

                {profile?.joined_at && (
                  <div>
                    <span>Member since</span>
                    <strong>{longDate(profile.joined_at)}</strong>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* REPORTING PERIOD */}

          <section className="mp-period">
            <div className="mp-period-title">
              <CalendarDays size={20} />
              <div>
                <strong>Reporting period</strong>
                <span>{rangeLabel}</span>
              </div>
            </div>

            <div className="mp-period-controls">
              <div className="mp-field">
                <span>Report type</span>
                <div className="mp-segment" role="group" aria-label="Report type">
                  <button
                    className={period === "monthly" ? "active" : ""}
                    onClick={() => setPeriod("monthly")}
                  >
                    Monthly
                  </button>
                  <button
                    className={period === "annual" ? "active" : ""}
                    onClick={() => setPeriod("annual")}
                  >
                    Annual
                  </button>
                </div>
              </div>

              <label className="mp-field">
                <span>Financial year</span>
                <select
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(Number(event.target.value))}
                >
                  {financialYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>

              {period === "monthly" && (
                <label className="mp-field">
                  <span>Month</span>
                  <select
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(event.target.value)}
                  >
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </section>

          {error && (
            <div className="mp-error" role="alert">
              <span>{error}</span>
              <button onClick={() => setReloadKey((key) => key + 1)}>
                Try again
              </button>
            </div>
          )}

          {loading ? (
            <div className="mp-loading">
              <LoaderCircle className="mp-spinner" size={28} />
              Loading your financial records...
            </div>
          ) : (
            <>
              {/* =================== DASHBOARD =================== */}

              {activePage === "Dashboard" && (
                <>
                  <div className="mp-section-heading">
                    <h2>Financial overview</h2>
                    <p>{reportTitle}</p>
                  </div>

                  <div className="mp-kpis">
                    <Kpi
                      icon={PiggyBank}
                      tone="blue"
                      label="Savings contributions"
                      value={money(totals.savings)}
                    >
                      <Trend
                        current={totals.savings}
                        previous={previous.savings}
                        vsLabel={vsLabel}
                      />
                    </Kpi>

                    <Kpi
                      icon={Percent}
                      tone="gold"
                      label="Interest contributions"
                      value={money(totals.interest)}
                    >
                      <Trend
                        current={totals.interest}
                        previous={previous.interest}
                        vsLabel={vsLabel}
                      />
                    </Kpi>

                    <Kpi
                      icon={Landmark}
                      tone="green"
                      label="Total contributed"
                      value={money(totals.contributed)}
                    >
                      <Trend
                        current={totals.contributed}
                        previous={previous.contributed}
                        vsLabel={vsLabel}
                      />
                    </Kpi>

                    <Kpi
                      icon={AlertTriangle}
                      tone="red"
                      label="Outstanding fines"
                      value={money(totals.outstandingFines)}
                    >
                      {money(totals.finesIssued)} issued in this period
                    </Kpi>

                    <Kpi
                      icon={Receipt}
                      tone="blue"
                      label="Total loan repayable"
                      value={money(totals.repayable)}
                    >
                      {money(totals.principal)} borrowed
                    </Kpi>

                    <Kpi
                      icon={HandCoins}
                      tone="gold"
                      label="Outstanding loan balance"
                      value={money(totals.outstandingLoans)}
                    >
                      {money(loanRepaid)} repaid so far
                    </Kpi>
                  </div>

                  <div className="mp-grid-main">
                    {chartCard}

                    <section className="mp-card mp-activity-card">
                      <div className="mp-card-head">
                        <div>
                          <h3>Recent activity</h3>
                          <p>Your latest financial transactions</p>
                        </div>
                      </div>

                      <div className="mp-chips" role="group" aria-label="Filter activity">
                        {activityFilters.map((filter) => (
                          <button
                            key={filter.id}
                            className={activityFilter === filter.id ? "active" : ""}
                            onClick={() => {
                              setActivityFilter(filter.id);
                              setShowAllActivity(false);
                            }}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>

                      <div
                        className={`mp-activity-list ${showAllActivity ? "scroll" : ""}`}
                      >
                        {visibleActivity.length > 0 ? (
                          visibleActivity.map((item) => (
                            <div className="mp-activity-item" key={item.id}>
                              <div className={`mp-activity-marker ${item.type}`} />

                              <div className="mp-activity-details">
                                <strong>{item.title}</strong>
                                <span>{item.detail}</span>
                                <small>{dateLabel(item.date)}</small>
                              </div>

                              <strong className="mp-activity-amount">
                                {money(item.amount)}
                              </strong>
                            </div>
                          ))
                        ) : (
                          <div className="mp-activity-empty">
                            No activity recorded for this period.
                          </div>
                        )}
                      </div>

                      {filteredActivity.length > 6 && (
                        <button
                          className="mp-link-button"
                          onClick={() => setShowAllActivity((value) => !value)}
                        >
                          {showAllActivity
                            ? "Show less"
                            : `Show all ${filteredActivity.length} transactions`}
                        </button>
                      )}
                    </section>
                  </div>

                  <div className="mp-grid-secondary">
                    <section className="mp-card mp-loan-card">
                      <div className="mp-card-head">
                        <div>
                          <h3>Loan repayment progress</h3>
                          <p>Based on loans issued during the selected period.</p>
                        </div>
                      </div>

                      <div className="mp-loan-body">
                        <div
                          className="mp-ring"
                          style={{ "--mp-angle": `${loanProgress * 3.6}deg` }}
                          role="img"
                          aria-label={`${loanProgress.toFixed(1)} percent repaid`}
                        >
                          <div>
                            <strong>{loanProgress.toFixed(1)}%</strong>
                            <span>repaid</span>
                          </div>
                        </div>

                        <div className="mp-loan-numbers">
                          <div>
                            <span>Amount repaid</span>
                            <strong>{money(loanRepaid)}</strong>
                          </div>
                          <div>
                            <span>Outstanding</span>
                            <strong>{money(totals.outstandingLoans)}</strong>
                          </div>
                          <div>
                            <span>Total repayable</span>
                            <strong>{money(totals.repayable)}</strong>
                          </div>
                        </div>
                      </div>

                      {loans.length > 0 ? (
                        <div className="mp-loan-list">
                          {loans.slice(0, 3).map((loan) => {
                            const repayable = num(loan.total_repayable);
                            const repaid = Math.max(
                              0,
                              repayable - num(loan.outstanding_balance)
                            );
                            const progress =
                              repayable > 0
                                ? Math.min(100, (repaid / repayable) * 100)
                                : 0;

                            return (
                              <div className="mp-loan-row" key={loan.loan_id}>
                                <div className="mp-loan-row-top">
                                  <span>
                                    {longDate(loan.loan_date)} loan of{" "}
                                    {money(loan.principal_amount)}
                                  </span>
                                  {statusPill(loan.payment_status, "loan")}
                                </div>

                                <div className="mp-progress-track">
                                  <div
                                    className="mp-progress-fill"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>

                                <small>
                                  {money(repaid)} of {money(repayable)} repaid
                                </small>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="mp-muted-note">
                          No loans were issued in this period.
                        </p>
                      )}
                    </section>

                    <section className="mp-card mp-info-card">
                      <div className="mp-card-head">
                        <div>
                          <h3>Membership</h3>
                          <p>Your details and overall position</p>
                        </div>
                      </div>

                      <dl className="mp-info-list">
                        <div>
                          <dt>Member name</dt>
                          <dd>{profile?.full_name}</dd>
                        </div>
                        <div>
                          <dt>Member number</dt>
                          <dd>{profile?.member_number || "—"}</dd>
                        </div>
                        <div>
                          <dt>Joined</dt>
                          <dd>{dateLabel(profile?.joined_at)}</dd>
                        </div>
                        <div>
                          <dt>Membership status</dt>
                          <dd>
                            <span
                              className={`mp-pill ${
                                profile?.membership_status === "active"
                                  ? "success"
                                  : "neutral"
                              }`}
                            >
                              {profile?.membership_status || "—"}
                            </span>
                          </dd>
                        </div>
                      </dl>

                      <h4 className="mp-info-subhead">Overall position (all time)</h4>

                      <dl className="mp-info-list">
                        <div>
                          <dt>Total savings</dt>
                          <dd>{money(lifetime.savings)}</dd>
                        </div>
                        <div>
                          <dt>Total interest</dt>
                          <dd>{money(lifetime.interest)}</dd>
                        </div>
                        <div>
                          <dt>Outstanding fines</dt>
                          <dd>{money(lifetime.outstandingFines)}</dd>
                        </div>
                        <div>
                          <dt>Outstanding loans</dt>
                          <dd>{money(lifetime.outstandingLoans)}</dd>
                        </div>
                      </dl>
                    </section>
                  </div>
                </>
              )}

              {/* =================== STATEMENT =================== */}

              {activePage === "Statement" && (
                <section className="mp-card mp-report">
                  <div className="mp-report-heading">
                    <div>
                      <span>0190 Social Club</span>
                      <h2>My financial statement</h2>
                      <p>{reportTitle}</p>
                    </div>

                    <button className="mp-btn primary" onClick={() => window.print()}>
                      <Printer size={16} />
                      Print / Save PDF
                    </button>
                  </div>

                  <div className="mp-report-details">
                    <div>
                      <span>Member</span>
                      <strong>{profile?.full_name}</strong>
                    </div>
                    <div>
                      <span>Member number</span>
                      <strong>{profile?.member_number || "—"}</strong>
                    </div>
                    <div>
                      <span>Report period</span>
                      <strong>{reportTitle}</strong>
                    </div>
                    <div>
                      <span>Generated</span>
                      <strong>{new Date().toLocaleDateString("en-ZA")}</strong>
                    </div>
                  </div>

                  <div className="mp-kpis">
                    <Kpi
                      icon={PiggyBank}
                      tone="blue"
                      label="Savings contributions"
                      value={money(totals.savings)}
                    />
                    <Kpi
                      icon={Percent}
                      tone="gold"
                      label="Interest contributions"
                      value={money(totals.interest)}
                    />
                    <Kpi
                      icon={Landmark}
                      tone="green"
                      label="Total contributed"
                      value={money(totals.contributed)}
                    />
                    <Kpi
                      icon={AlertTriangle}
                      tone="red"
                      label="Outstanding fines"
                      value={money(totals.outstandingFines)}
                    />
                    <Kpi
                      icon={Receipt}
                      tone="blue"
                      label="Total loan repayable"
                      value={money(totals.repayable)}
                    />
                    <Kpi
                      icon={HandCoins}
                      tone="gold"
                      label="Outstanding loan balance"
                      value={money(totals.outstandingLoans)}
                    />
                  </div>

                  <h3>Contribution history</h3>
                  <DataTable
                    headers={contributionHeaders}
                    rows={contributionRows}
                    footer={contributionFooter}
                    numeric={[1, 2, 3]}
                  />

                  <h3>Fine history</h3>
                  <DataTable
                    headers={fineHeaders}
                    rows={fineRows}
                    footer={fineFooter}
                    numeric={[2, 3, 4]}
                  />

                  <h3>Fine payments during this period</h3>
                  <DataTable
                    headers={finePaymentHeaders}
                    rows={finePaymentRows}
                    footer={finePaymentFooter}
                    numeric={[2]}
                  />

                  <h3>Loan history</h3>
                  <DataTable
                    headers={loanHeaders}
                    rows={loanRows}
                    footer={loanFooter}
                    numeric={[1, 2, 3, 4, 5]}
                  />

                  <h3>Loan repayments during this period</h3>
                  <DataTable
                    headers={loanPaymentHeaders}
                    rows={loanPaymentRows}
                    footer={loanPaymentFooter}
                    numeric={[2]}
                  />
                </section>
              )}

              {/* =================== CONTRIBUTIONS =================== */}

              {activePage === "Contributions" && (
                <>
                  <div className="mp-kpis cols-3">
                    <Kpi
                      icon={PiggyBank}
                      tone="blue"
                      label="Savings contributions"
                      value={money(totals.savings)}
                    >
                      <Trend
                        current={totals.savings}
                        previous={previous.savings}
                        vsLabel={vsLabel}
                      />
                    </Kpi>
                    <Kpi
                      icon={Percent}
                      tone="gold"
                      label="Interest contributions"
                      value={money(totals.interest)}
                    >
                      <Trend
                        current={totals.interest}
                        previous={previous.interest}
                        vsLabel={vsLabel}
                      />
                    </Kpi>
                    <Kpi
                      icon={Landmark}
                      tone="green"
                      label="Total contributed"
                      value={money(totals.contributed)}
                    >
                      <Trend
                        current={totals.contributed}
                        previous={previous.contributed}
                        vsLabel={vsLabel}
                      />
                    </Kpi>
                  </div>

                  <div className="mp-stack">{chartCard}</div>

                  <RecordTable
                    title="My contributions"
                    description="Your savings and interest contribution records."
                    headers={contributionHeaders}
                    rows={contributionRows}
                    footer={contributionFooter}
                    numeric={[1, 2, 3]}
                    exportName={`contributions-${reportTitle.replace(/\s+/g, "-")}.csv`}
                  />
                </>
              )}

              {/* =================== FINES =================== */}

              {activePage === "Fines" && (
                <>
                  <div className="mp-kpis cols-3">
                    <Kpi
                      icon={AlertTriangle}
                      tone="red"
                      label="Fines issued in period"
                      value={money(totals.finesIssued)}
                    />
                    <Kpi
                      icon={AlertTriangle}
                      tone="gold"
                      label="Outstanding fines"
                      value={money(totals.outstandingFines)}
                    />
                    <Kpi
                      icon={Wallet}
                      tone="green"
                      label="Payments during period"
                      value={money(totals.finePayments)}
                    />
                  </div>

                  <RecordTable
                    title="My fine records"
                    description="Fines issued during the selected reporting period."
                    headers={fineHeaders}
                    rows={fineRows}
                    footer={fineFooter}
                    numeric={[2, 3, 4]}
                    exportName={`fines-${reportTitle.replace(/\s+/g, "-")}.csv`}
                  />

                  <RecordTable
                    title="Fine payments"
                    description="Payments made during the selected reporting period."
                    headers={finePaymentHeaders}
                    rows={finePaymentRows}
                    footer={finePaymentFooter}
                    numeric={[2]}
                  />
                </>
              )}

              {/* =================== LOANS =================== */}

              {activePage === "Loans" && (
                <>
                  <div className="mp-kpis cols-3">
                    <Kpi
                      icon={Receipt}
                      tone="blue"
                      label="Total repayable"
                      value={money(totals.repayable)}
                    />
                    <Kpi
                      icon={HandCoins}
                      tone="gold"
                      label="Outstanding balance"
                      value={money(totals.outstandingLoans)}
                    />
                    <Kpi
                      icon={Wallet}
                      tone="green"
                      label="Repayments during period"
                      value={money(totals.loanPayments)}
                    />
                  </div>

                  <RecordTable
                    title="My loans"
                    description="Loans issued during the selected reporting period."
                    headers={loanHeaders}
                    rows={loanRows}
                    footer={loanFooter}
                    numeric={[1, 2, 3, 4, 5]}
                    exportName={`loans-${reportTitle.replace(/\s+/g, "-")}.csv`}
                  />

                  <RecordTable
                    title="Loan repayments"
                    description="Repayments made during the selected reporting period."
                    headers={loanPaymentHeaders}
                    rows={loanPaymentRows}
                    footer={loanPaymentFooter}
                    numeric={[2]}
                  />
                </>
              )}
            </>
          )}
        </div>

        <footer className="mp-footer">
          0190 Social Club © {new Date().getFullYear()}
        </footer>
      </main>
    </div>
  );
}

/* =========================================
   KPI CARD
   ========================================= */

function Kpi({ icon: Icon, label, value, tone = "blue", children }) {
  return (
    <div className={`mp-kpi ${tone}`}>
      <div className="mp-kpi-top">
        <span>{label}</span>
        <div className="mp-kpi-icon">
          <Icon size={17} />
        </div>
      </div>

      <strong>{value}</strong>

      {children && <div className="mp-kpi-foot">{children}</div>}
    </div>
  );
}

/* =========================================
   TREND BADGE (compared with previous period)
   ========================================= */

function Trend({ current, previous, vsLabel }) {
  if (!current && !previous) {
    return <span className="mp-trend flat">No activity yet</span>;
  }

  if (!previous) {
    return (
      <span className="mp-trend up">
        <TrendingUp size={13} />
        New this period
      </span>
    );
  }

  const change = ((current - previous) / previous) * 100;
  const up = change >= 0;

  return (
    <span className={`mp-trend ${up ? "up" : "down"}`}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {Math.abs(change).toFixed(0)}% {vsLabel}
    </span>
  );
}

/* =========================================
   CONTRIBUTION CHART (bars or running total)
   ========================================= */

function ContributionChart({ data, mode }) {
  const [hover, setHover] = useState(null);

  const count = data.length;
  const peak = Math.max(
    0,
    ...data.map((item) =>
      mode === "bars" ? Math.max(item.savings, item.interest) : item.cumulative
    )
  );
  const max = niceCeil(peak);
  const ticks = Array.from({ length: AXIS_STEPS + 1 }, (_, i) => (max / AXIS_STEPS) * i);
  const hasData = data.some((item) => item.total > 0);

  const centre = (index) => ((index + 0.5) / count) * 100;
  const points = data.map(
    (item, index) => `${centre(index)},${100 - (item.cumulative / max) * 100}`
  );

  const active = hover !== null ? data[hover] : null;
  const shift = hover === null ? 0 : hover < count * 0.2 ? -12 : hover > count * 0.8 ? -88 : -50;

  return (
    <div className="mp-chart">
      <div className="mp-chart-y" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick} style={{ bottom: `${(tick / max) * 100}%` }}>
            {compactMoney(tick)}
          </span>
        ))}
      </div>

      <div className="mp-chart-plot">
        <div className="mp-chart-grid" aria-hidden="true">
          {ticks.map((tick) => (
            <i key={tick} style={{ bottom: `${(tick / max) * 100}%` }} />
          ))}
        </div>

        {mode === "cumulative" && hasData && (
          <svg
            className="mp-chart-svg"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="mp-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "var(--mp-primary)", stopOpacity: 0.4 }} />
                <stop offset="100%" style={{ stopColor: "var(--mp-primary)", stopOpacity: 0.03 }} />
              </linearGradient>
            </defs>

            <polygon
              points={`${centre(0)},100 ${points.join(" ")} ${centre(count - 1)},100`}
              fill="url(#mp-area)"
            />
            <polyline
              points={points.join(" ")}
              fill="none"
              stroke="var(--mp-gold)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        <div className="mp-chart-cols" onMouseLeave={() => setHover(null)}>
          {data.map((item, index) => (
            <div
              key={item.key}
              className={`mp-chart-col ${hover === index ? "hover" : ""}`}
              onMouseEnter={() => setHover(index)}
              onClick={() => setHover(index)}
            >
              {mode === "bars" && (
                <>
                  <div
                    className="mp-bar savings"
                    style={{
                      height: `${(item.savings / max) * 100}%`,
                      minHeight: item.savings > 0 ? 3 : 0,
                    }}
                  />
                  <div
                    className="mp-bar interest"
                    style={{
                      height: `${(item.interest / max) * 100}%`,
                      minHeight: item.interest > 0 ? 3 : 0,
                    }}
                  />
                </>
              )}
            </div>
          ))}
        </div>

        {mode === "cumulative" && active && (
          <div
            className="mp-chart-dot"
            style={{
              left: `${centre(hover)}%`,
              bottom: `${(active.cumulative / max) * 100}%`,
            }}
          />
        )}

        {active && (
          <div
            className="mp-tooltip"
            style={{
              left: `${centre(hover)}%`,
              transform: `translateX(${shift}%)`,
            }}
          >
            <strong>{active.full}</strong>
            <div>
              <span>
                <i className="savings" />
                Savings
              </span>
              <b>{money(active.savings)}</b>
            </div>
            <div>
              <span>
                <i className="interest" />
                Interest
              </span>
              <b>{money(active.interest)}</b>
            </div>
            <div className="mp-tooltip-total">
              <span>Running total</span>
              <b>{money(active.cumulative)}</b>
            </div>
          </div>
        )}

        {!hasData && (
          <div className="mp-chart-empty">
            No contributions recorded for this period.
          </div>
        )}
      </div>

      <div className="mp-chart-x" aria-hidden="true">
        {data.map((item) => (
          <span key={item.key}>{item.showLabel ? item.label : ""}</span>
        ))}
      </div>
    </div>
  );
}

/* =========================================
   TABLES
   ========================================= */

function DataTable({
  headers,
  rows,
  footer,
  numeric = [],
  emptyText = "No records found for this period.",
}) {
  const align = (index) => (numeric.includes(index) ? "num" : undefined);

  return (
    <div className="mp-table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={`${header}-${index}`} className={align(index)}>
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className={align(cellIndex)}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={headers.length} className="mp-empty-row">
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>

        {footer && rows.length > 0 && (
          <tfoot>
            <tr>
              {footer.map((cell, index) => (
                <td key={index} className={align(index)}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function RecordTable({
  title,
  description,
  headers,
  rows,
  footer,
  numeric,
  exportName,
}) {
  const [query, setQuery] = useState("");

  const term = query.trim().toLowerCase();
  const filtered = term
    ? rows.filter((row) =>
        row.some((cell) => String(cellText(cell)).toLowerCase().includes(term))
      )
    : rows;

  return (
    <section className="mp-card mp-record-card">
      <div className="mp-record-head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <div className="mp-record-tools">
          {rows.length > 5 && (
            <label className="mp-search">
              <Search size={15} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search records"
                aria-label={`Search ${title}`}
              />
            </label>
          )}

          {exportName && rows.length > 0 && (
            <button
              className="mp-btn ghost"
              onClick={() =>
                downloadCsv(
                  exportName,
                  headers,
                  filtered.map((row) => row.map(cellText))
                )
              }
            >
              <Download size={15} />
              Export CSV
            </button>
          )}
        </div>
      </div>

      <DataTable
        headers={headers}
        rows={filtered}
        footer={term ? null : footer}
        numeric={numeric}
        emptyText={term ? "No records match your search." : undefined}
      />
    </section>
  );
}