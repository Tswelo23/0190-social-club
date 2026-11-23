import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Plus,
  Search,
  X,
  Wallet,
  Percent,
  Receipt,
  TrendingDown,
  Trash2,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import "./Loans.css";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const money = (value) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(Number(value || 0));

const dateLabel = (value) =>
  value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-ZA") : "—";

const statusLabel = (status) => {
  if (status === "paid") return "Fully Repaid";
  if (status === "partially_paid") return "Partially Repaid";
  return "Outstanding";
};

export default function Loans() {
  const [members, setMembers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [repayments, setRepayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingLoanId, setDeletingLoanId] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const [showLoanForm, setShowLoanForm] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);
  const [paymentLoan, setPaymentLoan] = useState(null);
  const [historyLoan, setHistoryLoan] = useState(null);

  const [loanForm, setLoanForm] = useState({
    memberId: "",
    principal: "",
    interest: "0",
    loanDate: today(),
    notes: "",
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentDate: today(),
    notes: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [memberResult, loanResult, repaymentResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, member_number, account_status")
            .eq("role", "member")
            .order("full_name"),

          supabase
            .from("loan_balances")
            .select("*")
            .order("loan_date", { ascending: false }),

          supabase
            .from("loan_repayments")
            .select("id, loan_id, amount, payment_date, notes, created_at")
            .order("payment_date", { ascending: false }),
        ]);

      if (memberResult.error) throw memberResult.error;
      if (loanResult.error) throw loanResult.error;
      if (repaymentResult.error) throw repaymentResult.error;

      const memberMap = new Map(
        (memberResult.data || []).map((m) => [m.id, m])
      );

      setMembers(memberResult.data || []);
      setLoans(
        (loanResult.data || []).map((loan) => ({
          ...loan,
          member: memberMap.get(loan.member_id) || null,
        }))
      );
      setRepayments(repaymentResult.data || []);
    } catch (err) {
      console.error("Error loading loans:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalPrincipal = loans.reduce(
    (sum, loan) => sum + Number(loan.principal_amount || 0), 0
  );

  const totalInterest = loans.reduce(
    (sum, loan) => sum + Number(loan.interest_amount || 0), 0
  );

  const totalRepayable = loans.reduce(
    (sum, loan) => sum + Number(loan.total_repayable || 0), 0
  );

  const totalPaid = loans.reduce(
    (sum, loan) => sum + Number(loan.total_repaid || 0), 0
  );

  const outstanding = loans.reduce(
    (sum, loan) => sum + Number(loan.outstanding_balance || 0), 0
  );

  const activeLoanCount = loans.filter(
    (loan) => Number(loan.outstanding_balance) > 0
  ).length;

  const filteredLoans = useMemo(() => {
    const term = search.toLowerCase();

    return loans.filter((loan) => {
      const name = loan.member?.full_name?.toLowerCase() || "";
      const number = loan.member?.member_number?.toLowerCase() || "";
      const matchesSearch = name.includes(term) || number.includes(term);

      const matchesFilter =
        filter === "all" ||
        (filter === "outstanding" &&
          loan.payment_status === "unpaid") ||
        (filter === "partial" &&
          loan.payment_status === "partially_paid") ||
        (filter === "paid" &&
          loan.payment_status === "paid");

      return matchesSearch && matchesFilter;
    });
  }, [loans, search, filter]);

  const resetLoanForm = () => {
    setLoanForm({
      memberId: "",
      principal: "",
      interest: "0",
      loanDate: today(),
      notes: "",
    });
    setEditingLoan(null);
  };

  const openNewLoan = () => {
    setError("");
    resetLoanForm();
    setShowLoanForm(true);
  };

  const openEditLoan = (loan) => {
    setError("");
    setEditingLoan(loan);
    setLoanForm({
      memberId: loan.member_id,
      principal: String(loan.principal_amount),
      interest: String(loan.interest_amount || 0),
      loanDate: loan.loan_date,
      notes: loan.notes || "",
    });
    setShowLoanForm(true);
  };

  const saveLoan = async (event) => {
    event.preventDefault();
    setError("");

    const principal = Number(loanForm.principal);
    const interest = Number(loanForm.interest);

    if (!loanForm.memberId) {
      setError("Please select a member.");
      return;
    }

    if (!Number.isFinite(principal) || principal <= 0) {
      setError("Enter a valid principal amount.");
      return;
    }

    if (!Number.isFinite(interest) || interest < 0) {
      setError("Interest cannot be negative.");
      return;
    }

    if (!loanForm.loanDate) {
      setError("Please select a loan date.");
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please log in again.");

      const record = {
        member_id: loanForm.memberId,
        principal_amount: principal,
        interest_amount: interest,
        loan_date: loanForm.loanDate,
        notes: loanForm.notes.trim() || null,
      };

      let result;

      if (editingLoan) {
        result = await supabase
          .from("loans")
          .update(record)
          .eq("id", editingLoan.loan_id);
      } else {
        result = await supabase
          .from("loans")
          .insert({
            ...record,
            status: "active",
            recorded_by: user.id,
          });
      }

      if (result.error) throw result.error;

      setShowLoanForm(false);
      resetLoanForm();
      await loadData();
    } catch (err) {
      console.error("Error saving loan:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openPayment = (loan) => {
    setError("");
    setPaymentLoan(loan);
    setPaymentForm({
      amount: "",
      paymentDate: today(),
      notes: "",
    });
  };

  const savePayment = async (event) => {
    event.preventDefault();
    setError("");

    const amount = Number(paymentForm.amount);

    if (!paymentLoan) {
      setError("Please select a loan.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid repayment amount.");
      return;
    }

    if (
      Math.round(amount * 100) >
      Math.round(Number(paymentLoan.outstanding_balance) * 100)
    ) {
      setError("Payment cannot exceed the outstanding balance.");
      return;
    }

    if (!paymentForm.paymentDate) {
      setError("Please select a payment date.");
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please log in again.");

      const { error: insertError } = await supabase
        .from("loan_repayments")
        .insert({
          loan_id: paymentLoan.loan_id,
          amount,
          payment_date: paymentForm.paymentDate,
          notes: paymentForm.notes.trim() || null,
          recorded_by: user.id,
        });

      if (insertError) throw insertError;

      setPaymentLoan(null);
      await loadData();
    } catch (err) {
      console.error("Error recording repayment:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const loanPayments = (loanId) =>
    repayments.filter((payment) => payment.loan_id === loanId);

  // Permanently delete a loan together with its repayment records.
  const handleDeleteLoan = async (loan) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete this loan?\n\n` +
        `Member: ${loan.member?.full_name || "Unknown member"}\n` +
        `Principal: ${money(loan.principal_amount)}\n` +
        `Interest: ${money(loan.interest_amount)}\n` +
        `Total repayable: ${money(loan.total_repayable)}\n` +
        `Total repaid: ${money(loan.total_repaid)}\n\n` +
        `WARNING: All repayment transactions associated with this loan will also be permanently deleted. This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setError("");
      setDeletingLoanId(loan.loan_id);

      const { error: deleteError } = await supabase.rpc(
        "delete_loan_with_repayments",
        {
          p_loan_id: loan.loan_id,
        }
      );

      if (deleteError) throw deleteError;

      setLoans((previous) =>
        previous.filter((item) => item.loan_id !== loan.loan_id)
      );

      setRepayments((previous) =>
        previous.filter((payment) => payment.loan_id !== loan.loan_id)
      );

      if (historyLoan?.loan_id === loan.loan_id) {
        setHistoryLoan(null);
      }

      alert("Loan and associated repayment records deleted successfully.");
    } catch (err) {
      console.error("Error deleting loan:", err);
      setError(err.message || "Unable to delete loan.");
    } finally {
      setDeletingLoanId(null);
    }
  };

  const closeLoanForm = () => {
    setShowLoanForm(false);
    resetLoanForm();
    setError("");
  };

  return (
    <div className="loans-page">
      <div className="loans-heading">
        <div>
          <span className="loans-eyebrow">FINANCIAL MANAGEMENT</span>
          <h1>Loans Management</h1>
          <p>Issue loans, manage interest and track member repayments.</p>
        </div>

        <button className="loan-primary-button" onClick={openNewLoan}>
          <Plus size={18} /> Issue Loan
        </button>
      </div>

      {error && !showLoanForm && !paymentLoan && !historyLoan && (
        <div className="loans-error">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      <div className="loans-stat-grid">
        <Stat icon={<Wallet />} label="Principal Issued" value={money(totalPrincipal)} />
        <Stat icon={<Percent />} label="Interest Charged" value={money(totalInterest)} />
        <Stat icon={<Receipt />} label="Repayments Received" value={money(totalPaid)} />
        <Stat icon={<TrendingDown />} label="Outstanding Balance" value={money(outstanding)} />
      </div>

      <div className="loans-overview-line">
        <span>{loans.length} total loan records</span>
        <span>{activeLoanCount} loans with outstanding balances</span>
        <span>Total repayable: <strong>{money(totalRepayable)}</strong></span>
      </div>

      <div className="loans-toolbar">
        <div className="loans-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member or member number..."
          />
        </div>

        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All loans</option>
          <option value="outstanding">Outstanding</option>
          <option value="partial">Partially repaid</option>
          <option value="paid">Fully repaid</option>
        </select>
      </div>

      <section className="loans-table-card">
        <div className="loans-table-heading">
          <h2>Loan Records</h2>
          <p>Principal, manually entered interest and repayment balances.</p>
        </div>

        {loading ? (
          <div className="loans-empty">Loading loans...</div>
        ) : (
          <div className="loans-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Member No.</th>
                  <th>Loan Date</th>
                  <th>Principal</th>
                  <th>Interest</th>
                  <th>Total Repayable</th>
                  <th>Repaid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="loans-empty">
                      No loan records found.
                    </td>
                  </tr>
                ) : (
                  filteredLoans.map((loan) => (
                    <tr key={loan.loan_id}>
                      <td>{loan.member?.full_name || "Unknown member"}</td>
                      <td>{loan.member?.member_number || "—"}</td>
                      <td>{dateLabel(loan.loan_date)}</td>
                      <td>{money(loan.principal_amount)}</td>
                      <td>{money(loan.interest_amount)}</td>
                      <td>{money(loan.total_repayable)}</td>
                      <td>{money(loan.total_repaid)}</td>
                      <td>{money(loan.outstanding_balance)}</td>
                      <td>
                        <span className={`loan-status ${loan.payment_status}`}>
                          {statusLabel(loan.payment_status)}
                        </span>
                      </td>
                      <td>
                        <div className="loan-actions">
                          {Number(loan.outstanding_balance) > 0 && (
                            <button
                              className="loan-pay-button"
                              onClick={() => openPayment(loan)}
                            >
                              Record payment
                            </button>
                          )}
                          <button
                            className="loan-history-button"
                            onClick={() => setHistoryLoan(loan)}
                          >
                            History
                          </button>
                          {loan.status === "active" && (
                            <button
                              className="loan-edit-button"
                              onClick={() => openEditLoan(loan)}
                            >
                              Edit
                            </button>
                          )}
                          <button
                            className="loan-delete-button"
                            disabled={deletingLoanId === loan.loan_id}
                            onClick={() => handleDeleteLoan(loan)}
                          >
                            <Trash2 size={14} />
                            {deletingLoanId === loan.loan_id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showLoanForm && (
        <div className="loan-modal-backdrop">
          <div className="loan-modal">
            <ModalHeading
              title={editingLoan ? "Edit Loan" : "Issue New Loan"}
              subtitle="Enter the principal and the interest amount determined by the club."
              onClose={closeLoanForm}
            />

            {error && <div className="loans-error">{error}</div>}

            <form onSubmit={saveLoan}>
              <div className="loan-form-group">
                <label>Member</label>
                <select
                  required
                  value={loanForm.memberId}
                  onChange={(e) =>
                    setLoanForm({ ...loanForm, memberId: e.target.value })
                  }
                >
                  <option value="">Select member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name} ({member.member_number})
                      {member.account_status === "disabled" ? " - Disabled" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="loan-form-group">
                <label>Principal Amount (R)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={loanForm.principal}
                  onChange={(e) =>
                    setLoanForm({ ...loanForm, principal: e.target.value })
                  }
                />
              </div>

              <div className="loan-form-group">
                <label>Interest Amount (R)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={loanForm.interest}
                  onChange={(e) =>
                    setLoanForm({ ...loanForm, interest: e.target.value })
                  }
                />
                <small>Enter the exact interest amount. No percentage is calculated automatically.</small>
              </div>

              <div className="loan-form-group">
                <label>Loan Date</label>
                <input
                  type="date"
                  required
                  value={loanForm.loanDate}
                  onChange={(e) =>
                    setLoanForm({ ...loanForm, loanDate: e.target.value })
                  }
                />
              </div>

              <div className="loan-total-preview">
                <span>Total repayable</span>
                <strong>
                  {money(Number(loanForm.principal || 0) + Number(loanForm.interest || 0))}
                </strong>
              </div>

              <div className="loan-form-group">
                <label>Notes (Optional)</label>
                <textarea
                  rows="3"
                  value={loanForm.notes}
                  onChange={(e) =>
                    setLoanForm({ ...loanForm, notes: e.target.value })
                  }
                />
              </div>

              <div className="loan-modal-actions">
                <button type="button" className="loan-secondary-button" onClick={closeLoanForm}>
                  Cancel
                </button>
                <button type="submit" className="loan-primary-button" disabled={saving}>
                  {saving ? "Saving..." : editingLoan ? "Update Loan" : "Issue Loan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {paymentLoan && (
        <div className="loan-modal-backdrop">
          <div className="loan-modal">
            <ModalHeading
              title="Record Loan Repayment"
              subtitle={`${paymentLoan.member?.full_name || "Member"} — Loan`}
              onClose={() => setPaymentLoan(null)}
            />

            {error && <div className="loans-error">{error}</div>}

            <div className="loan-balance-box">
              <span>Outstanding balance</span>
              <strong>{money(paymentLoan.outstanding_balance)}</strong>
            </div>

            <form onSubmit={savePayment}>
              <div className="loan-form-group">
                <label>Payment Amount (R)</label>
                <input
                  type="number"
                  min="0.01"
                  max={paymentLoan.outstanding_balance}
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, amount: e.target.value })
                  }
                />
              </div>

              <div className="loan-form-group">
                <label>Payment Date</label>
                <input
                  type="date"
                  required
                  value={paymentForm.paymentDate}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, paymentDate: e.target.value })
                  }
                />
              </div>

              <div className="loan-form-group">
                <label>Notes (Optional)</label>
                <textarea
                  rows="3"
                  value={paymentForm.notes}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, notes: e.target.value })
                  }
                />
              </div>

              <div className="loan-modal-actions">
                <button type="button" className="loan-secondary-button" onClick={() => setPaymentLoan(null)}>
                  Cancel
                </button>
                <button type="submit" className="loan-primary-button" disabled={saving}>
                  {saving ? "Saving..." : "Save Repayment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyLoan && (
        <div className="loan-modal-backdrop">
          <div className="loan-modal">
            <ModalHeading
              title="Loan Repayment History"
              subtitle={`${historyLoan.member?.full_name || "Member"} — ${dateLabel(historyLoan.loan_date)}`}
              onClose={() => setHistoryLoan(null)}
            />

            <div className="loan-history-summary">
              <p>Principal: <strong>{money(historyLoan.principal_amount)}</strong></p>
              <p>Interest: <strong>{money(historyLoan.interest_amount)}</strong></p>
              <p>Total repayable: <strong>{money(historyLoan.total_repayable)}</strong></p>
              <p>Total repaid: <strong>{money(historyLoan.total_repaid)}</strong></p>
              <p>Outstanding: <strong>{money(historyLoan.outstanding_balance)}</strong></p>
            </div>

            <h3>Repayment transactions</h3>
            <div className="loan-history-list">
              {loanPayments(historyLoan.loan_id).length === 0 ? (
                <p>No repayments recorded yet.</p>
              ) : (
                loanPayments(historyLoan.loan_id).map((payment) => (
                  <div className="loan-history-item" key={payment.id}>
                    <div>
                      <strong>{money(payment.amount)}</strong>
                      <p>{dateLabel(payment.payment_date)}</p>
                      {payment.notes && <small>{payment.notes}</small>}
                    </div>
                    <span className="loan-status paid">Recorded</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="loans-stat-card">
      <div className="loans-stat-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <h2>{value}</h2>
      </div>
    </div>
  );
}

function ModalHeading({ title, subtitle, onClose }) {
  return (
    <div className="loan-modal-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <button type="button" className="loan-close-button" onClick={onClose}>
        <X size={20} />
      </button>
    </div>
  );
}