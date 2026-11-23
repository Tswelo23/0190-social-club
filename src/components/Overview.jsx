import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Users,
  Wallet,
  Percent,
  AlertTriangle,
  HandCoins,
  CalendarDays,
  Clock,
  Receipt,
  RefreshCw,
  Target,
  TrendingUp,
  TrendingDown,
  Download,
  Search,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import "./Overview.css";

/* =========================================
   CLUB SETTINGS (change these in one place)
   ========================================= */

const SAVINGS_TARGET = 4000; // minimum savings per member, per year
const FIRST_OPERATING_YEAR = 2027; // set to 2026 while you are still testing
const CYCLE_MONTHS = 11; // 11 = Feb–Dec (as before). Use 12 to include January,
//                          which is how the member portal reports its year.

/* =========================================
   HELPERS
   ========================================= */

const currency = (value) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const compactMoney = (value) => {
  const n = Number(value || 0);
  if (n >= 1000) return `R${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `R${Math.round(n)}`;
};

const num = (value) => Number(value || 0);

const formatDate = (date) => {
  if (!date) return "—";

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toIso = (date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

const cycleRange = (year) => ({
  start: `${year}-02-01`,
  end: toIso(new Date(year, 1 + CYCLE_MONTHS, 1)),
});

const initials = (name) =>
  (name || "?")
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// Financial years run from February, so January belongs to the previous year
const getCurrentFinancialYear = () => {
  const now = new Date();
  return now.getMonth() >= 1 ? now.getFullYear() : now.getFullYear() - 1;
};

const DEFAULT_YEAR = Math.max(getCurrentFinancialYear(), FIRST_OPERATING_YEAR);

const AVAILABLE_YEARS = Array.from(
  { length: Math.max(DEFAULT_YEAR, 2028) - 2026 + 1 },
  (_, index) => 2026 + index
).reverse();

const TYPE_FILTERS = [
  { id: "all", label: "All" },
  { id: "savings", label: "Savings" },
  { id: "interest", label: "Interest" },
  { id: "fine", label: "Fine payments" },
  { id: "loan", label: "Loan repayments" },
];

const TYPE_LABELS = {
  savings: "Savings Contribution",
  interest: "Interest Contribution",
  fine: "Fine Payment",
  loan: "Loan Repayment",
};

const EMPTY_DATA = {
  members: [],
  contributions: [],
  previousContributions: [],
  fineBalances: [],
  finePayments: [],
  fineRecords: [],
  loanBalances: [],
  loanRepayments: [],
  loanRecords: [],
};

const sumOf = (items, field) =>
  items.reduce((total, item) => total + num(item[field]), 0);

const niceCeil = (value) => {
  if (value <= 0) return 100;
  const exponent = Math.pow(10, Math.floor(Math.log10(value)));
  const fraction = value / exponent;
  const options = [1, 1.5, 2, 2.5, 4, 5, 7.5, 10];
  return (options.find((option) => fraction <= option + 1e-9) || 10) * exponent;
};

const AXIS_STEPS = 5;

/* =========================================
   DASHBOARD
   ========================================= */

function Overview() {
  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState(null);
  const [data, setData] = useState(EMPTY_DATA);

  const [chartMode, setChartMode] = useState("monthly");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(10);

  const loadDashboard = useCallback(
    async (isCancelled = () => false) => {
      setLoading(true);
      setError("");

      const { start, end } = cycleRange(selectedYear);
      const previous = cycleRange(selectedYear - 1);

      try {
        const results = await Promise.all([
          // 0 Member profiles
          supabase
            .from("profiles")
            .select("id, full_name, member_number, account_status")
            .eq("role", "member"),

          // 1 Savings and interest contributions (this cycle)
          supabase
            .from("contributions")
            .select("id, member_id, amount, interest_contribution, contribution_date")
            .gte("contribution_date", start)
            .lt("contribution_date", end)
            .order("contribution_date", { ascending: false }),

          // 2 Contributions of the previous cycle, for the trend badges
          supabase
            .from("contributions")
            .select("amount, interest_contribution")
            .gte("contribution_date", previous.start)
            .lt("contribution_date", previous.end),

          // 3 Outstanding fine balances for fines issued this cycle
          supabase
            .from("fine_balances")
            .select("member_id, outstanding_balance, fine_date")
            .gte("fine_date", start)
            .lt("fine_date", end),

          // 4 Fine payments received this cycle
          supabase
            .from("fine_payments")
            .select("id, fine_id, amount, payment_date")
            .gte("payment_date", start)
            .lt("payment_date", end)
            .order("payment_date", { ascending: false }),

          // 5 Fine-to-member lookup
          supabase.from("fines").select("id, member_id"),

          // 6 Outstanding loan balances for loans issued this cycle
          supabase
            .from("loan_balances")
            .select("member_id, outstanding_balance, loan_date")
            .gte("loan_date", start)
            .lt("loan_date", end),

          // 7 Loan repayments received this cycle
          supabase
            .from("loan_repayments")
            .select("id, loan_id, amount, payment_date")
            .gte("payment_date", start)
            .lt("payment_date", end)
            .order("payment_date", { ascending: false }),

          // 8 Loan-to-member lookup
          supabase.from("loans").select("id, member_id"),
        ]);

        const failed = results.find((result) => result.error);
        if (failed) throw failed.error;

        if (isCancelled()) return;

        setData({
          members: results[0].data || [],
          contributions: results[1].data || [],
          previousContributions: results[2].data || [],
          fineBalances: results[3].data || [],
          finePayments: results[4].data || [],
          fineRecords: results[5].data || [],
          loanBalances: results[6].data || [],
          loanRepayments: results[7].data || [],
          loanRecords: results[8].data || [],
        });

        setUpdatedAt(new Date());
      } catch (err) {
        console.error("Dashboard loading error:", err);
        if (!isCancelled()) {
          setError(err.message || "Unable to load dashboard information.");
        }
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [selectedYear]
  );

  useEffect(() => {
    let cancelled = false;
    loadDashboard(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [loadDashboard]);

  const {
    members,
    contributions,
    previousContributions,
    fineBalances,
    finePayments,
    fineRecords,
    loanBalances,
    loanRepayments,
    loanRecords,
  } = data;

  /* ---------- members ---------- */

  const memberNames = useMemo(
    () =>
      Object.fromEntries(
        members.map((member) => [member.id, member.full_name || "Unnamed member"])
      ),
    [members]
  );

  const activeMemberList = useMemo(
    () => members.filter((member) => member.account_status === "active"),
    [members]
  );

  const activeMembers = activeMemberList.length;

  /* ---------- totals ---------- */

  const totals = useMemo(
    () => ({
      savings: sumOf(contributions, "amount"),
      interest: sumOf(contributions, "interest_contribution"),
      outstandingFines: sumOf(fineBalances, "outstanding_balance"),
      finePayments: sumOf(finePayments, "amount"),
      loanRepayments: sumOf(loanRepayments, "amount"),
      outstandingLoans: sumOf(loanBalances, "outstanding_balance"),
    }),
    [contributions, fineBalances, finePayments, loanBalances, loanRepayments]
  );

  const previousTotals = useMemo(
    () => ({
      savings: sumOf(previousContributions, "amount"),
      interest: sumOf(previousContributions, "interest_contribution"),
    }),
    [previousContributions]
  );

  /* ---------- savings target ---------- */

  const memberProgress = useMemo(() => {
    const savedBy = new Map();

    contributions.forEach((item) => {
      savedBy.set(item.member_id, (savedBy.get(item.member_id) || 0) + num(item.amount));
    });

    return activeMemberList
      .map((member) => {
        const saved = savedBy.get(member.id) || 0;
        return {
          id: member.id,
          name: member.full_name || "Unnamed member",
          saved,
          percent: Math.min(100, (saved / SAVINGS_TARGET) * 100),
          reached: saved >= SAVINGS_TARGET,
        };
      })
      .sort((a, b) => b.saved - a.saved);
  }, [contributions, activeMemberList]);

  const membersOnTarget = memberProgress.filter((member) => member.reached).length;
  const clubTarget = activeMembers * SAVINGS_TARGET;
  const clubProgress =
    clubTarget > 0 ? Math.min(100, (totals.savings / clubTarget) * 100) : 0;

  /* ---------- monthly chart ---------- */

  const monthlyData = useMemo(() => {
    const buckets = Array.from({ length: CYCLE_MONTHS }, (_, index) => {
      const date = new Date(selectedYear, 1 + index, 1);

      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
        label: date.toLocaleDateString("en-ZA", { month: "short" }),
        full: date.toLocaleDateString("en-ZA", { month: "long", year: "numeric" }),
        savings: 0,
        interest: 0,
      };
    });

    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    contributions.forEach((item) => {
      const bucket = byKey.get(item.contribution_date.slice(0, 7));

      if (bucket) {
        bucket.savings += num(item.amount);
        bucket.interest += num(item.interest_contribution);
      }
    });

    let running = 0;

    return buckets.map((bucket) => {
      running += bucket.savings;
      return { ...bucket, running };
    });
  }, [contributions, selectedYear]);

  /* ---------- where the money came from ---------- */

  const breakdown = useMemo(() => {
    const items = [
      { id: "savings", label: "Savings", value: totals.savings, color: "var(--ov-c-blue)" },
      { id: "interest", label: "Interest", value: totals.interest, color: "var(--ov-c-purple)" },
      { id: "fine", label: "Fine payments", value: totals.finePayments, color: "var(--ov-c-orange)" },
      { id: "loan", label: "Loan repayments", value: totals.loanRepayments, color: "var(--ov-c-green)" },
    ];

    const total = items.reduce((sum, item) => sum + item.value, 0);

    let cursor = 0;
    const stops = items
      .filter((item) => item.value > 0)
      .map((item) => {
        const from = cursor;
        cursor += (item.value / total) * 100;
        return `${item.color} ${from}% ${cursor}%`;
      });

    return {
      total,
      gradient: total > 0 ? `conic-gradient(${stops.join(", ")})` : undefined,
      items: items.map((item) => ({
        ...item,
        percent: total > 0 ? (item.value / total) * 100 : 0,
      })),
    };
  }, [totals]);

  /* ---------- members with outstanding balances ---------- */

  const outstandingByMember = useMemo(() => {
    const map = new Map();

    const add = (id, field, value) => {
      const row = map.get(id) || { fines: 0, loans: 0 };
      row[field] += value;
      map.set(id, row);
    };

    fineBalances.forEach((row) => add(row.member_id, "fines", num(row.outstanding_balance)));
    loanBalances.forEach((row) => add(row.member_id, "loans", num(row.outstanding_balance)));

    return [...map.entries()]
      .map(([id, row]) => ({
        id,
        name: memberNames[id] || "Member",
        fines: row.fines,
        loans: row.loans,
        total: row.fines + row.loans,
      }))
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [fineBalances, loanBalances, memberNames]);

  const largestOutstanding = outstandingByMember[0]?.total || 1;

  /* ---------- transactions ---------- */

  const fineMemberLookup = useMemo(
    () => Object.fromEntries(fineRecords.map((fine) => [fine.id, fine.member_id])),
    [fineRecords]
  );

  const loanMemberLookup = useMemo(
    () => Object.fromEntries(loanRecords.map((loan) => [loan.id, loan.member_id])),
    [loanRecords]
  );

  const transactions = useMemo(() => {
    const nameOf = (id) => memberNames[id] || "Member";

    return [
      ...contributions.map((item) => ({
        id: `savings-${item.id}`,
        member: nameOf(item.member_id),
        kind: "savings",
        date: item.contribution_date,
        amount: num(item.amount),
      })),
      ...contributions
        .filter((item) => num(item.interest_contribution) > 0)
        .map((item) => ({
          id: `interest-${item.id}`,
          member: nameOf(item.member_id),
          kind: "interest",
          date: item.contribution_date,
          amount: num(item.interest_contribution),
        })),
      ...finePayments.map((item) => ({
        id: `fine-payment-${item.id}`,
        member: nameOf(fineMemberLookup[item.fine_id]),
        kind: "fine",
        date: item.payment_date,
        amount: num(item.amount),
      })),
      ...loanRepayments.map((item) => ({
        id: `loan-repayment-${item.id}`,
        member: nameOf(loanMemberLookup[item.loan_id]),
        kind: "loan",
        date: item.payment_date,
        amount: num(item.amount),
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, [
    contributions,
    finePayments,
    loanRepayments,
    fineMemberLookup,
    loanMemberLookup,
    memberNames,
  ]);

  const term = search.trim().toLowerCase();

  const filteredTransactions = transactions.filter(
    (item) =>
      (typeFilter === "all" || item.kind === typeFilter) &&
      (!term || item.member.toLowerCase().includes(term))
  );

  const visibleTransactions = filteredTransactions.slice(0, visibleCount);

  const exportTransactions = () => {
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Member", "Transaction type", "Date", "Amount (ZAR)"],
      ...filteredTransactions.map((item) => [
        item.member,
        TYPE_LABELS[item.kind],
        item.date,
        item.amount.toFixed(2),
      ]),
    ];

    const csv = rows.map((row) => row.map(escape).join(",")).join("\n");
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `transactions-${selectedYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  /* ---------- statistic cards ---------- */

  const vsLabel = "vs last cycle";

  const statistics = [
    {
      title: "Active Members",
      value: activeMembers,
      note: `of ${members.length} registered members`,
      icon: Users,
      color: "blue",
    },
    {
      title: "Total Savings",
      value: currency(totals.savings),
      note: (
        <Trend current={totals.savings} previous={previousTotals.savings} vsLabel={vsLabel} />
      ),
      icon: Wallet,
      color: "green",
    },
    {
      title: "Interest Collected",
      value: currency(totals.interest),
      note: (
        <Trend current={totals.interest} previous={previousTotals.interest} vsLabel={vsLabel} />
      ),
      icon: Percent,
      color: "purple",
    },
    {
      title: "Members on Target",
      value: `${membersOnTarget} of ${activeMembers}`,
      note: `Reached ${currency(SAVINGS_TARGET).replace(",00", "")} in savings`,
      icon: Target,
      color: "blue",
    },
    {
      title: "Fine Payments Received",
      value: currency(totals.finePayments),
      note: `Payments received in ${selectedYear}`,
      icon: Receipt,
      color: "blue",
    },
    {
      title: "Loan Repayments Received",
      value: currency(totals.loanRepayments),
      note: `Repayments received in ${selectedYear}`,
      icon: HandCoins,
      color: "green",
    },
    {
      title: "Outstanding Fines",
      value: currency(totals.outstandingFines),
      note: `Unpaid balances on ${selectedYear} fines`,
      icon: AlertTriangle,
      color: "orange",
    },
    {
      title: "Outstanding Loans",
      value: currency(totals.outstandingLoans),
      note: `Remaining balances on ${selectedYear} loans`,
      icon: Wallet,
      color: "orange",
    },
  ];

  const cycleLabel = (() => {
    const { start, end } = cycleRange(selectedYear);
    const last = new Date(`${end}T00:00:00`);
    last.setDate(last.getDate() - 1);
    return `${formatDate(start)} – ${formatDate(toIso(last))}`;
  })();

  const firstLoad = loading && !updatedAt;

  /* =========================================
     RENDER
     ========================================= */

  return (
    <div className="ov">
      {/* Heading */}
      <section className="ov-heading">
        <div>
          <span className="ov-kicker">Financial management</span>
          <h1>Dashboard Overview</h1>
          <p>Welcome to the 0190 Social Club management portal.</p>
        </div>

        <div className="ov-controls">
          <div className="ov-cycle">
            <strong>{selectedYear} cycle</strong>
            <span>{cycleLabel}</span>
          </div>

          <select
            value={selectedYear}
            onChange={(event) => {
              setSelectedYear(Number(event.target.value));
              setVisibleCount(10);
            }}
            aria-label="Select financial year"
          >
            {AVAILABLE_YEARS.map((year) => (
              <option key={year} value={year}>
                {year} Financial Cycle
              </option>
            ))}
          </select>

          <button className="ov-refresh" onClick={() => loadDashboard()} disabled={loading}>
            <RefreshCw size={16} className={loading ? "ov-spin" : ""} />
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </section>

      {error && (
        <div className="ov-error" role="alert">
          <strong>Dashboard error:</strong> {error}
        </div>
      )}

      {firstLoad ? (
        <div className="ov-loading">
          <RefreshCw size={22} className="ov-spin" />
          <span>Loading dashboard information...</span>
        </div>
      ) : (
        <div className={`ov-body ${loading ? "refreshing" : ""}`}>
          {updatedAt && (
            <p className="ov-updated">
              Last updated{" "}
              {updatedAt.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}

          {/* Statistics */}
          <section className="ov-stats">
            {statistics.map((stat) => {
              const Icon = stat.icon;

              return (
                <div className="ov-stat" key={stat.title}>
                  <div className={`ov-stat-icon ${stat.color}`}>
                    <Icon size={22} />
                  </div>

                  <div className="ov-stat-body">
                    <span className="ov-stat-title">{stat.title}</span>
                    <h2>{stat.value}</h2>
                    <span className="ov-stat-note">{stat.note}</span>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Chart and year-end summary */}
          <section className="ov-grid-main">
            <div className="ov-panel ov-chart-panel">
              <div className="ov-panel-head">
                <div>
                  <h3>{chartMode === "monthly" ? "Monthly Savings" : "Savings vs Club Target"}</h3>
                  <p>
                    {chartMode === "monthly"
                      ? `Savings and interest received in ${selectedYear}`
                      : `Running savings total against ${activeMembers} × ${currency(SAVINGS_TARGET).replace(",00", "")}`}
                  </p>
                </div>

                <div className="ov-segment" role="group" aria-label="Chart type">
                  <button
                    className={chartMode === "monthly" ? "active" : ""}
                    onClick={() => setChartMode("monthly")}
                  >
                    Monthly
                  </button>
                  <button
                    className={chartMode === "running" ? "active" : ""}
                    onClick={() => setChartMode("running")}
                  >
                    Running total
                  </button>
                </div>
              </div>

              <TrendChart
                data={monthlyData}
                mode={chartMode}
                target={clubTarget}
              />

              <div className="ov-legend">
                {chartMode === "monthly" ? (
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
                  <>
                    <span>
                      <i className="running" />
                      Running savings
                    </span>
                    <span>
                      <i className="target" />
                      Club target
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="ov-panel ov-year">
              <div className="ov-panel-head">
                <div>
                  <h3>Year-End Summary</h3>
                  <p>Club financial cycle</p>
                </div>

                <CalendarDays size={21} />
              </div>

              <div className="ov-target">
                <span>Minimum savings target</span>
                <strong>R{SAVINGS_TARGET.toLocaleString("en-ZA")}</strong>
                <small>Per member annually</small>
              </div>

              <div className="ov-club-progress">
                <div className="ov-club-progress-top">
                  <span>Club savings progress</span>
                  <strong>{clubProgress.toFixed(1)}%</strong>
                </div>

                <div className="ov-track">
                  <div className="ov-fill" style={{ width: `${clubProgress}%` }} />
                </div>

                <small>
                  {currency(totals.savings)} of {currency(clubTarget)}
                </small>
              </div>

              <div className="ov-members-progress">
                <h4>Member progress</h4>

                {memberProgress.length > 0 ? (
                  <ul>
                    {memberProgress.map((member) => (
                      <li key={member.id}>
                        <div className="ov-members-progress-top">
                          <span>{member.name}</span>
                          <strong>
                            {compactMoney(member.saved)} / {compactMoney(SAVINGS_TARGET)}
                          </strong>
                        </div>

                        <div className="ov-track thin">
                          <div
                            className={`ov-fill ${member.reached ? "done" : ""}`}
                            style={{ width: `${member.percent}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="ov-muted">No active members yet.</p>
                )}
              </div>

              <div className="ov-payout">
                <CalendarDays size={20} />

                <div>
                  <strong>Annual Payout</strong>
                  <span>Second week of December</span>
                </div>
              </div>
            </div>
          </section>

          {/* Breakdown and outstanding balances */}
          <section className="ov-grid-two">
            <div className="ov-panel">
              <div className="ov-panel-head">
                <div>
                  <h3>Money Received</h3>
                  <p>Share of everything collected in {selectedYear}</p>
                </div>
              </div>

              <div className="ov-donut-body">
                <div
                  className={`ov-donut ${breakdown.total > 0 ? "" : "empty"}`}
                  style={{ background: breakdown.gradient }}
                  role="img"
                  aria-label="Breakdown of money received"
                >
                  <div>
                    <span>Total received</span>
                    <strong>{currency(breakdown.total)}</strong>
                  </div>
                </div>

                <ul className="ov-breakdown">
                  {breakdown.items.map((item) => (
                    <li key={item.id}>
                      <i style={{ background: item.color }} />
                      <span>{item.label}</span>
                      <strong>{currency(item.value)}</strong>
                      <small>{item.percent.toFixed(0)}%</small>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="ov-panel">
              <div className="ov-panel-head">
                <div>
                  <h3>Outstanding Balances</h3>
                  <p>Members with unpaid fines or loans from {selectedYear}</p>
                </div>
              </div>

              {outstandingByMember.length > 0 ? (
                <ul className="ov-owing">
                  {outstandingByMember.slice(0, 6).map((row) => (
                    <li key={row.id}>
                      <div className="ov-avatar">{initials(row.name)}</div>

                      <div className="ov-owing-body">
                        <div className="ov-owing-top">
                          <strong>{row.name}</strong>
                          <strong>{currency(row.total)}</strong>
                        </div>

                        <div className="ov-track thin">
                          <div
                            className="ov-fill warn"
                            style={{ width: `${(row.total / largestOutstanding) * 100}%` }}
                          />
                        </div>

                        <small>
                          Fines {currency(row.fines)} · Loans {currency(row.loans)}
                        </small>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ov-muted padded">
                  Nothing outstanding. Every fine and loan from this cycle is settled.
                </p>
              )}
            </div>
          </section>

          {/* Transactions */}
          <section className="ov-panel">
            <div className="ov-panel-head wrap">
              <div>
                <h3>Recent Transactions</h3>
                <p>Latest financial activities recorded in {selectedYear}</p>
              </div>

              <div className="ov-tools">
                <label className="ov-search">
                  <Search size={15} />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setVisibleCount(10);
                    }}
                    placeholder="Search member"
                    aria-label="Search transactions by member"
                  />
                </label>

                <button
                  className="ov-refresh"
                  onClick={exportTransactions}
                  disabled={filteredTransactions.length === 0}
                >
                  <Download size={15} />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="ov-chips" role="group" aria-label="Filter transactions">
              {TYPE_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  className={typeFilter === filter.id ? "active" : ""}
                  onClick={() => {
                    setTypeFilter(filter.id);
                    setVisibleCount(10);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="ov-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Transaction type</th>
                    <th>Date</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="ov-empty-row">
                        {transactions.length === 0
                          ? "No transactions recorded for this financial cycle."
                          : "No transactions match your filters."}
                      </td>
                    </tr>
                  ) : (
                    visibleTransactions.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="ov-member-cell">
                            <div className="ov-avatar">{initials(item.member)}</div>
                            <strong>{item.member}</strong>
                          </div>
                        </td>

                        <td>
                          <span className={`ov-type ${item.kind}`}>
                            {TYPE_LABELS[item.kind]}
                          </span>
                        </td>

                        <td>{formatDate(item.date)}</td>

                        <td className="num ov-amount">{currency(item.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredTransactions.length > visibleCount && (
              <button
                className="ov-link"
                onClick={() => setVisibleCount((count) => count + 10)}
              >
                Show more ({filteredTransactions.length - visibleCount} remaining)
              </button>
            )}
          </section>

          {/* Club activities */}
          <section className="ov-grid-two">
            <div className="ov-panel ov-activity">
              <div className="ov-activity-icon">
                <Clock size={22} />
              </div>

              <div>
                <h3>Monthly Club Meetings</h3>
                <p>First Sunday of every month at 15:00.</p>
              </div>
            </div>

            <div className="ov-panel ov-activity">
              <div className="ov-activity-icon green">
                <Receipt size={22} />
              </div>

              <div>
                <h3>Banking Contributions</h3>
                <p>Monday to Wednesday following the meeting.</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/* =========================================
   TREND BADGE
   ========================================= */

function Trend({ current, previous, vsLabel }) {
  if (!current && !previous) {
    return <span className="ov-trend flat">No activity yet</span>;
  }

  if (!previous) {
    return (
      <span className="ov-trend up">
        <TrendingUp size={13} />
        First cycle with data
      </span>
    );
  }

  const change = ((current - previous) / previous) * 100;
  const up = change >= 0;

  return (
    <span className={`ov-trend ${up ? "up" : "down"}`}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {Math.abs(change).toFixed(0)}% {vsLabel}
    </span>
  );
}

/* =========================================
   CHART: monthly bars, or running total vs target
   ========================================= */

function TrendChart({ data, mode, target }) {
  const [hover, setHover] = useState(null);

  const count = data.length;
  const running = mode === "running";

  const peak = Math.max(
    0,
    target,
    ...data.map((item) => (running ? item.running : Math.max(item.savings, item.interest)))
  );
  const max = niceCeil(running ? peak : Math.max(0, ...data.map((d) => Math.max(d.savings, d.interest))));
  const ticks = Array.from({ length: AXIS_STEPS + 1 }, (_, i) => (max / AXIS_STEPS) * i);
  const hasData = data.some((item) => item.savings > 0 || item.interest > 0);

  const centre = (index) => ((index + 0.5) / count) * 100;
  const points = data.map((item, index) => `${centre(index)},${100 - (item.running / max) * 100}`);

  const active = hover !== null ? data[hover] : null;
  const shift = hover === null ? 0 : hover < count * 0.2 ? -12 : hover > count * 0.8 ? -88 : -50;

  return (
    <div className="ov-chart">
      <div className="ov-chart-y" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick} style={{ bottom: `${(tick / max) * 100}%` }}>
            {compactMoney(tick)}
          </span>
        ))}
      </div>

      <div className="ov-chart-plot">
        <div className="ov-chart-grid" aria-hidden="true">
          {ticks.map((tick) => (
            <i key={tick} style={{ bottom: `${(tick / max) * 100}%` }} />
          ))}
        </div>

        {running && hasData && (
          <svg className="ov-chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="ov-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: "var(--ov-c-blue)", stopOpacity: 0.38 }} />
                <stop offset="100%" style={{ stopColor: "var(--ov-c-blue)", stopOpacity: 0.03 }} />
              </linearGradient>
            </defs>

            <polygon
              points={`${centre(0)},100 ${points.join(" ")} ${centre(count - 1)},100`}
              fill="url(#ov-area)"
            />
            <polyline
              points={points.join(" ")}
              fill="none"
              stroke="var(--ov-c-blue)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        {running && target > 0 && (
          <div className="ov-target-line" style={{ bottom: `${(target / max) * 100}%` }}>
            <span>Target {compactMoney(target)}</span>
          </div>
        )}

        <div className="ov-chart-cols" onMouseLeave={() => setHover(null)}>
          {data.map((item, index) => (
            <div
              key={item.key}
              className={`ov-chart-col ${hover === index ? "hover" : ""}`}
              onMouseEnter={() => setHover(index)}
              onClick={() => setHover(index)}
            >
              {!running && (
                <>
                  <div
                    className="ov-bar savings"
                    style={{
                      height: `${(item.savings / max) * 100}%`,
                      minHeight: item.savings > 0 ? 3 : 0,
                    }}
                  />
                  <div
                    className="ov-bar interest"
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

        {running && active && (
          <div
            className="ov-chart-dot"
            style={{ left: `${centre(hover)}%`, bottom: `${(active.running / max) * 100}%` }}
          />
        )}

        {active && (
          <div
            className="ov-tooltip"
            style={{ left: `${centre(hover)}%`, transform: `translateX(${shift}%)` }}
          >
            <strong>{active.full}</strong>
            <div>
              <span>
                <i className="savings" />
                Savings
              </span>
              <b>{currency(active.savings)}</b>
            </div>
            <div>
              <span>
                <i className="interest" />
                Interest
              </span>
              <b>{currency(active.interest)}</b>
            </div>
            <div className="ov-tooltip-total">
              <span>Running savings</span>
              <b>{currency(active.running)}</b>
            </div>
          </div>
        )}

        {!hasData && (
          <div className="ov-chart-empty">No contributions recorded for this cycle.</div>
        )}
      </div>

      <div className="ov-chart-x" aria-hidden="true">
        {data.map((item) => (
          <span key={item.key}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

export default Overview;