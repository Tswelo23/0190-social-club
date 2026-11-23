import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Printer,
  RefreshCw,
  Search,
  Wallet,
  Percent,
  HandCoins,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import "./AnnualReports.css";

const money = (value) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(Number(value || 0));

const months = [
  { number: 2, name: "February" },
  { number: 3, name: "March" },
  { number: 4, name: "April" },
  { number: 5, name: "May" },
  { number: 6, name: "June" },
  { number: 7, name: "July" },
  { number: 8, name: "August" },
  { number: 9, name: "September" },
  { number: 10, name: "October" },
  { number: 11, name: "November" },
  { number: 12, name: "December" },
];

const categories = [
  {
    type: "Savings Contribution",
    label: "Savings Contributions",
    icon: Wallet,
  },
  {
    type: "Interest Contribution",
    label: "Interest Contributions",
    icon: Percent,
  },
  {
    type: "Fine Issued",
    label: "Fines Issued",
    icon: AlertTriangle,
  },
  {
    type: "Fine Payment",
    label: "Fine Payments Received",
    icon: HandCoins,
  },
  {
    type: "Loan Principal Issued",
    label: "Loan Principal Issued",
    icon: Wallet,
  },
  {
    type: "Loan Interest Charged",
    label: "Loan Interest Charged",
    icon: Percent,
  },
  {
    type: "Loan Repayment",
    label: "Loan Repayments Received",
    icon: HandCoins,
  },
];

export default function AnnualReports() {
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(String(currentYear));
  const [transactions, setTransactions] = useState([]);
  const [members, setMembers] = useState([]);
  const [fineBalances, setFineBalances] = useState([]);
  const [loanBalances, setLoanBalances] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");

      const startDate = `${year}-02-01`;
      const endDate = `${Number(year) + 1}-01-01`;

      const [
        transactionResult,
        memberResult,
        fineResult,
        loanResult,
      ] = await Promise.all([
        supabase
          .from("annual_financial_transactions")
          .select("*")
          .gte("transaction_date", startDate)
          .lt("transaction_date", endDate)
          .order("transaction_date", { ascending: true }),

        supabase
          .from("profiles")
          .select("id, full_name, member_number")
          .eq("role", "member")
          .order("full_name"),

        supabase
          .from("fine_balances")
          .select("member_id, outstanding_balance"),

        supabase
          .from("loan_balances")
          .select("member_id, outstanding_balance"),
      ]);

      if (transactionResult.error) throw transactionResult.error;
      if (memberResult.error) throw memberResult.error;
      if (fineResult.error) throw fineResult.error;
      if (loanResult.error) throw loanResult.error;

      setTransactions(transactionResult.data || []);
      setMembers(memberResult.data || []);
      setFineBalances(fineResult.data || []);
      setLoanBalances(loanResult.data || []);
    } catch (err) {
      console.error("Annual report error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [year]);

  const totals = useMemo(() => {
    const result = {};

    categories.forEach((category) => {
      result[category.type] = 0;
    });

    transactions.forEach((transaction) => {
      if (transaction.transaction_type in result) {
        result[transaction.transaction_type] += Number(
          transaction.amount || 0
        );
      }
    });

    return result;
  }, [transactions]);

  const receiptBalances = useMemo(() => {
    const savings = totals["Savings Contribution"] || 0;
    const interest = totals["Interest Contribution"] || 0;
    const finePayments = totals["Fine Payment"] || 0;
    const loanRepayments = totals["Loan Repayment"] || 0;

    return {
      savings,
      interest,
      finePayments,
      loanRepayments,
      totalReceived:
        savings + interest + finePayments + loanRepayments,
    };
  }, [totals]);

  const monthlyData = useMemo(() => {
    return months.map((month) => {
      const monthTransactions = transactions.filter(
        (transaction) =>
          new Date(`${transaction.transaction_date}T00:00:00`).getMonth() + 1 ===
          month.number
      );

      const getTotal = (type) =>
        monthTransactions
          .filter((transaction) => transaction.transaction_type === type)
          .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

      return {
        ...month,
        savings: getTotal("Savings Contribution"),
        interest: getTotal("Interest Contribution"),
        finePayments: getTotal("Fine Payment"),
        loanRepayments: getTotal("Loan Repayment"),
      };
    });
  }, [transactions]);

  const memberRows = useMemo(() => {
    const fineMap = new Map();
    const loanMap = new Map();

    fineBalances.forEach((fine) => {
      fineMap.set(
        fine.member_id,
        (fineMap.get(fine.member_id) || 0) +
          Number(fine.outstanding_balance || 0)
      );
    });

    loanBalances.forEach((loan) => {
      loanMap.set(
        loan.member_id,
        (loanMap.get(loan.member_id) || 0) +
          Number(loan.outstanding_balance || 0)
      );
    });

    const rows = members.map((member) => {
      const memberTransactions = transactions.filter(
        (transaction) => transaction.member_id === member.id
      );

      const getTotal = (type) =>
        memberTransactions
          .filter((transaction) => transaction.transaction_type === type)
          .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

      return {
        ...member,
        savings: getTotal("Savings Contribution"),
        interest: getTotal("Interest Contribution"),
        finePayments: getTotal("Fine Payment"),
        loanRepayments: getTotal("Loan Repayment"),
        outstandingFines: fineMap.get(member.id) || 0,
        outstandingLoans: loanMap.get(member.id) || 0,
      };
    });

    return rows.filter((member) =>
      `${member.full_name} ${member.member_number || ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [members, transactions, fineBalances, loanBalances, search]);

  const maximumMonthlySavings = Math.max(
    ...monthlyData.map((month) => Math.max(month.savings, month.interest)),
    1
  );

  const exportCSV = () => {
    const headers = [
      "Member",
      "Member Number",
      "Savings",
      "Interest Contributions",
      "Fine Payments",
      "Loan Repayments",
      "Outstanding Fines",
      "Outstanding Loans",
    ];

    const rows = memberRows.map((member) => [
      member.full_name,
      member.member_number || "",
      member.savings,
      member.interest,
      member.finePayments,
      member.loanRepayments,
      member.outstandingFines,
      member.outstandingLoans,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `0190-annual-report-${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="annual-reports-page">
      <div className="annual-heading">
        <div>
          <span className="annual-eyebrow">FINANCIAL MANAGEMENT</span>
          <h1>Annual Financial Reports</h1>
          <p>Review club finances and member transactions.</p>
        </div>

        <div className="annual-actions">
          <button className="annual-secondary-button" onClick={loadReport}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="annual-secondary-button" onClick={exportCSV}>
            <Download size={16} /> Export CSV
          </button>
          <button className="annual-primary-button" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      <div className="annual-period-card">
        <div>
          <label htmlFor="annual-year">Reporting year</label>
          <select
            id="annual-year"
            value={year}
            onChange={(event) => setYear(event.target.value)}
          >
            {Array.from({ length: 8 }, (_, index) => currentYear - index).map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              )
            )}
          </select>
        </div>
        <span>Reporting cycle: 1 February – 31 December {year}</span>
      </div>

      {error && <div className="annual-error">{error}</div>}

      {loading ? (
        <div className="annual-empty">Loading annual report...</div>
      ) : (
        <>
          <section className="annual-receipts-section">
            <div className="annual-section-heading">
              <h2>Financial Balances</h2>
              <p>
                Total amounts received during {year} (February–December).
              </p>
            </div>

            <div className="annual-receipts-grid">
              <div className="annual-receipt-card">
                <span>Savings Contributions</span>
                <h3>{money(receiptBalances.savings)}</h3>
              </div>

              <div className="annual-receipt-card">
                <span>Interest Contributions</span>
                <h3>{money(receiptBalances.interest)}</h3>
              </div>

              <div className="annual-receipt-card">
                <span>Fine Payments Received</span>
                <h3>{money(receiptBalances.finePayments)}</h3>
              </div>

              <div className="annual-receipt-card">
                <span>Loan Repayments Received</span>
                <h3>{money(receiptBalances.loanRepayments)}</h3>
              </div>
            </div>

            <div className="annual-total-receipts">
              <div>
                <span>Total Receipts</span>
                <p>Savings + interest + fine payments + loan repayments</p>
              </div>
              <h2>{money(receiptBalances.totalReceived)}</h2>
            </div>
          </section>

          <div className="annual-section-heading">
            <h2>Financial Overview</h2>
            <p>Transactions recorded during the selected reporting period.</p>
          </div>

          <div className="annual-stat-grid">
            {categories.map((category) => {
              const Icon = category.icon;

              return (
                <div className="annual-stat-card" key={category.type}>
                  <div className="annual-stat-icon">
                    <Icon size={21} />
                  </div>
                  <div>
                    <p>{category.label}</p>
                    <h3>{money(totals[category.type])}</h3>
                  </div>
                </div>
              );
            })}
          </div>

          <section className="annual-panel">
            <div className="annual-panel-heading">
              <div>
                <h2>Monthly Savings and Interest</h2>
                <p>February to December {year}</p>
              </div>
            </div>

            <div className="annual-month-chart">
              {monthlyData.map((month) => (
                <div className="annual-month-column" key={month.number}>
                  <div className="annual-bars">
                    <div
                      className="annual-bar savings-bar"
                      title={`Savings: ${money(month.savings)}`}
                      style={{
                        height: `${(month.savings / maximumMonthlySavings) * 100}%`,
                      }}
                    />
                    <div
                      className="annual-bar interest-bar"
                      title={`Interest: ${money(month.interest)}`}
                      style={{
                        height: `${(month.interest / maximumMonthlySavings) * 100}%`,
                      }}
                    />
                  </div>
                  <span>{month.name.slice(0, 3)}</span>
                </div>
              ))}
            </div>

            <div className="annual-chart-legend">
              <span><i className="legend-savings" /> Savings</span>
              <span><i className="legend-interest" /> Interest contributions</span>
            </div>

            <div className="annual-month-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Savings</th>
                    <th>Interest Contributions</th>
                    <th>Fine Payments</th>
                    <th>Loan Repayments</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((month) => (
                    <tr key={month.number}>
                      <td>{month.name}</td>
                      <td>{money(month.savings)}</td>
                      <td>{money(month.interest)}</td>
                      <td>{money(month.finePayments)}</td>
                      <td>{money(month.loanRepayments)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="annual-panel">
            <div className="annual-panel-heading">
              <div>
                <h2>Member Financial Comparison</h2>
                <p>Annual activity and current outstanding balances.</p>
              </div>
            </div>

            <div className="annual-member-search">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search member or member number..."
              />
            </div>

            <div className="annual-member-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Savings</th>
                    <th>Interest</th>
                    <th>Fine Payments</th>
                    <th>Loan Repayments</th>
                    <th>Outstanding Fines</th>
                    <th>Outstanding Loans</th>
                  </tr>
                </thead>
                <tbody>
                  {memberRows.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="annual-empty">
                        No members found.
                      </td>
                    </tr>
                  ) : (
                    memberRows.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <strong>{member.full_name}</strong>
                          <small>{member.member_number || "—"}</small>
                        </td>
                        <td>{money(member.savings)}</td>
                        <td>{money(member.interest)}</td>
                        <td>{money(member.finePayments)}</td>
                        <td>{money(member.loanRepayments)}</td>
                        <td>{money(member.outstandingFines)}</td>
                        <td>{money(member.outstandingLoans)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}