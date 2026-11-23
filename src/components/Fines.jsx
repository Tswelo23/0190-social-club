import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Plus,
  Search,
  X,
  CalendarDays,
  Receipt,
  Wallet,
  Trash2,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import "./Fines.css";

const FINE_REASONS = [
  "Not coming",
  "No contribution",
  "Failure to pay interest",
  "Cell phone",
  "Disobedience",
  "Other fines",
];

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
];

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(Number(amount || 0));

// Local date (not UTC), so South African users get the correct "today"
const todayString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDate = (value) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-ZA")
    : "—";

const getStatusLabel = (status) => {
  switch (status) {
    case "paid":
      return "Paid";
    case "partially_paid":
      return "Partially Paid";
    case "overdue":
      return "Overdue";
    default:
      return "Unpaid";
  }
};

export default function Fines() {
  const [members, setMembers] = useState([]);
  const [fines, setFines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingFineId, setDeletingFineId] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);

  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentDate: todayString(),
    notes: "",
  });

  const [paymentHistory, setPaymentHistory] = useState([]);
  const [historyFine, setHistoryFine] = useState(null);

  const [formData, setFormData] = useState({
    memberId: "",
    fineDate: todayString(),
    notes: "",
    amounts: {},
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [membersResult, balancesResult, paymentsResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, member_number, account_status")
            .eq("role", "member")
            .order("full_name"),

          supabase
            .from("fine_balances")
            .select("*")
            .order("fine_date", { ascending: false }),

          supabase
            .from("fine_payments")
            .select("id, fine_id, amount, payment_date, notes, created_at")
            .order("payment_date", { ascending: false }),
        ]);

      if (membersResult.error) throw membersResult.error;
      if (balancesResult.error) throw balancesResult.error;
      if (paymentsResult.error) throw paymentsResult.error;

      const memberLookup = new Map(
        (membersResult.data || []).map((member) => [member.id, member])
      );

      setMembers(membersResult.data || []);
      setFines(
        (balancesResult.data || []).map((fine) => ({
          ...fine,
          member: memberLookup.get(fine.member_id) || null,
        }))
      );
      setPaymentHistory(paymentsResult.data || []);
    } catch (err) {
      console.error("Error loading fine balances:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedReasons = FINE_REASONS.filter(
    (reason) => formData.amounts[reason] !== undefined
  );

  const selectedTotal = selectedReasons.reduce(
    (sum, reason) => sum + Number(formData.amounts[reason] || 0),
    0
  );

  const totalFines = fines.reduce(
    (sum, fine) => sum + Number(fine.fine_amount || 0),
    0
  );

  const totalFinePayments = fines.reduce(
    (sum, fine) => sum + Number(fine.total_paid || 0),
    0
  );

  const outstandingFines = fines.reduce(
    (sum, fine) => sum + Number(fine.outstanding_balance || 0),
    0
  );

  const overdueFines = fines.filter(
    (fine) => fine.payment_status === "overdue"
  );

  const overdueAmount = overdueFines.reduce(
    (sum, fine) => sum + Number(fine.outstanding_balance || 0),
    0
  );

  const filteredFines = useMemo(() => {
    const term = search.toLowerCase();

    return fines.filter((fine) => {
      const name = fine.member?.full_name?.toLowerCase() || "";
      const number = fine.member?.member_number?.toLowerCase() || "";
      const reason = fine.reason?.toLowerCase() || "";

      const matchesSearch =
        name.includes(term) ||
        number.includes(term) ||
        reason.includes(term);

      const matchesStatus =
        statusFilter === "all" || fine.payment_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [fines, search, statusFilter]);

  const toggleReason = (reason, checked) => {
    setFormData((previous) => {
      const amounts = { ...previous.amounts };

      if (checked) {
        amounts[reason] = "";
      } else {
        delete amounts[reason];
      }

      return { ...previous, amounts };
    });
  };

  const updateReasonAmount = (reason, amount) => {
    setFormData((previous) => ({
      ...previous,
      amounts: {
        ...previous.amounts,
        [reason]: amount,
      },
    }));
  };

  const resetForm = () => {
    setFormData({
      memberId: "",
      fineDate: todayString(),
      notes: "",
      amounts: {},
    });
  };

  const handleSaveFines = async (event) => {
    event.preventDefault();
    setError("");

    if (!formData.memberId) {
      setError("Please select a member.");
      return;
    }

    if (!formData.fineDate) {
      setError("Please select a fine date.");
      return;
    }

    if (selectedReasons.length === 0) {
      setError("Please select at least one fine reason.");
      return;
    }

    const invalidReason = selectedReasons.find((reason) => {
      const value = formData.amounts[reason];

      return (
        value === "" ||
        !Number.isFinite(Number(value)) ||
        Number(value) <= 0
      );
    });

    if (invalidReason) {
      setError(`Enter a valid amount for "${invalidReason}".`);
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user)
        throw new Error("Your session has expired. Please log in again.");

      const records = selectedReasons.map((reason) => ({
        member_id: formData.memberId,
        reason,
        amount: Number(formData.amounts[reason]),
        fine_date: formData.fineDate,
        notes: formData.notes.trim() || null,
        recorded_by: user.id,
      }));

      const { error: insertError } = await supabase
        .from("fines")
        .insert(records);

      if (insertError) throw insertError;

      resetForm();
      setShowForm(false);
      await loadData();
    } catch (err) {
      console.error("Error recording fines:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openPaymentForm = (fine) => {
    setError("");
    setPaymentTarget(fine);

    setPaymentForm({
      amount: "",
      paymentDate: todayString(),
      notes: "",
    });
  };

  const handleSavePayment = async (event) => {
    event.preventDefault();
    setError("");

    const amount = Number(paymentForm.amount);

    if (!paymentTarget) {
      setError("Please select a fine.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid payment amount.");
      return;
    }

    // Compare in whole cents to avoid decimal rounding problems
    if (
      Math.round(amount * 100) >
      Math.round(Number(paymentTarget.outstanding_balance) * 100)
    ) {
      setError("Payment cannot exceed the outstanding balance.");
      return;
    }

    if (!paymentForm.paymentDate) {
      setError("Please select a payment date.");
      return;
    }

    try {
      setPaymentSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please log in again.");

      const { error: insertError } = await supabase
        .from("fine_payments")
        .insert({
          fine_id: paymentTarget.fine_id,
          amount,
          payment_date: paymentForm.paymentDate,
          notes: paymentForm.notes.trim() || null,
          recorded_by: user.id,
        });

      if (insertError) throw insertError;

      setPaymentTarget(null);
      await loadData();
    } catch (err) {
      console.error("Error recording fine payment:", err);
      setError(err.message);
    } finally {
      setPaymentSaving(false);
    }
  };

  const getFinePayments = (fineId) =>
    paymentHistory.filter((payment) => payment.fine_id === fineId);

  const openPaymentHistory = (fine) => {
    setError("");
    setHistoryFine(fine);
  };

  // Permanently delete a fine together with its payment records.
  const handleDeleteFine = async (fine) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete this fine?\n\n` +
        `Member: ${fine.member?.full_name || "Unknown member"}\n` +
        `Reason: ${fine.reason}\n` +
        `Fine Amount: ${formatCurrency(fine.fine_amount)}\n` +
        `Paid: ${formatCurrency(fine.total_paid)}\n\n` +
        `WARNING: All payment records associated with this fine will also be deleted. This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setError("");
      setDeletingFineId(fine.fine_id);

      const { error: deleteError } = await supabase.rpc(
        "delete_fine_with_payments",
        {
          p_fine_id: fine.fine_id,
        }
      );

      if (deleteError) throw deleteError;

      setFines((previous) =>
        previous.filter((item) => item.fine_id !== fine.fine_id)
      );

      // Drop the deleted fine's payments from the in-page history too.
      setPaymentHistory((previous) =>
        previous.filter((payment) => payment.fine_id !== fine.fine_id)
      );

      alert("Fine and associated payment records deleted successfully.");
    } catch (err) {
      console.error("Error deleting fine:", err);
      setError(err.message || "Unable to delete fine.");
    } finally {
      setDeletingFineId(null);
    }
  };

  const anyModalOpen = showForm || paymentTarget || historyFine;

  return (
    <div className="fines-page">
      <div className="fines-heading">
        <div>
          <span className="fines-eyebrow">FINANCIAL MANAGEMENT</span>
          <h1>Fines Management</h1>
          <p>
            Record fines and payments. Each fine must be paid within one
            month of its fine date.
          </p>
        </div>

        <button
          className="fine-primary-button"
          onClick={() => {
            setError("");
            setShowForm(true);
          }}
        >
          <Plus size={18} />
          Record Fines
        </button>
      </div>

      {error && !anyModalOpen && (
        <div className="fines-error" role="alert">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="fines-stat-grid">
        <div className="fines-stat-card">
          <div className="fines-stat-icon">
            <Wallet size={22} />
          </div>
          <div>
            <p>Total Fines Issued</p>
            <h2>{formatCurrency(totalFines)}</h2>
          </div>
        </div>

        <div className="fines-stat-card">
          <div className="fines-stat-icon">
            <Receipt size={22} />
          </div>
          <div>
            <p>Payments Received</p>
            <h2>{formatCurrency(totalFinePayments)}</h2>
          </div>
        </div>

        <div className="fines-stat-card">
          <div className="fines-stat-icon">
            <CalendarDays size={22} />
          </div>
          <div>
            <p>Outstanding Fines</p>
            <h2>{formatCurrency(outstandingFines)}</h2>
          </div>
        </div>

        <div className="fines-stat-card">
          <div className="fines-stat-icon overdue-icon">
            <AlertTriangle size={22} />
          </div>
          <div>
            <p>Overdue ({overdueFines.length})</p>
            <h2>{formatCurrency(overdueAmount)}</h2>
          </div>
        </div>
      </div>

      <div className="fines-toolbar">
        <div className="fines-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search member or fine reason..."
          />
        </div>

        <select
          className="fines-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <section className="fines-table-card">
        <div className="fines-table-heading">
          <div>
            <h2>Fine History</h2>
            <p>Each selected reason is stored as a separate fine.</p>
          </div>
        </div>

        {loading ? (
          <div className="fines-empty">Loading fine records...</div>
        ) : (
          <div className="fines-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Member Number</th>
                  <th>Reason</th>
                  <th>Fine Date</th>
                  <th>Due Date</th>
                  <th>Fine Amount</th>
                  <th>Paid</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredFines.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="fines-empty">
                      No fine records found.
                    </td>
                  </tr>
                ) : (
                  filteredFines.map((fine) => (
                    <tr key={fine.fine_id}>
                      <td>{fine.member?.full_name || "Unknown member"}</td>
                      <td>{fine.member?.member_number || "—"}</td>
                      <td>
                        <span className="fine-reason-label">
                          {fine.reason}
                        </span>
                      </td>
                      <td>{formatDate(fine.fine_date)}</td>
                      <td>{formatDate(fine.due_date)}</td>
                      <td>{formatCurrency(fine.fine_amount)}</td>
                      <td>{formatCurrency(fine.total_paid)}</td>
                      <td>{formatCurrency(fine.outstanding_balance)}</td>
                      <td>
                        <span
                          className={`fine-status-badge ${fine.payment_status}`}
                        >
                          {getStatusLabel(fine.payment_status)}
                        </span>
                      </td>
                      <td>
                        <div className="fine-action-buttons">
                          {Number(fine.outstanding_balance) > 0 && (
                            <button
                              type="button"
                              className="fine-pay-button"
                              onClick={() => openPaymentForm(fine)}
                            >
                              Record Payment
                            </button>
                          )}

                          <button
                            type="button"
                            className="fine-history-button"
                            onClick={() => openPaymentHistory(fine)}
                          >
                            History
                          </button>

                          <button
                            type="button"
                            className="fine-delete-button"
                            disabled={deletingFineId === fine.fine_id}
                            onClick={() => handleDeleteFine(fine)}
                          >
                            <Trash2 size={14} />
                            {deletingFineId === fine.fine_id
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

      {/* Record fines modal */}
      {showForm && (
        <div className="fine-modal-backdrop">
          <div className="fine-modal">
            <div className="fine-modal-heading">
              <div>
                <h2>Record Member Fines</h2>
                <p>Select one or more reasons and enter each amount.</p>
              </div>

              <button
                type="button"
                className="fine-close-button"
                onClick={() => {
                  setShowForm(false);
                  setError("");
                }}
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="fines-error" role="alert">
                <AlertTriangle size={18} />
                {error}
              </div>
            )}

            <form onSubmit={handleSaveFines}>
              <div className="fine-form-group">
                <label>Member</label>
                <select
                  required
                  value={formData.memberId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      memberId: e.target.value,
                    })
                  }
                >
                  <option value="">Select a member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name} ({member.member_number})
                      {member.account_status === "disabled"
                        ? " - Disabled"
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="fine-form-group">
                <label>Fine Date</label>
                <input
                  type="date"
                  required
                  value={formData.fineDate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      fineDate: e.target.value,
                    })
                  }
                />
                <small className="fine-help-text">
                  Payment is due one month after this date.
                </small>
              </div>

              <div className="fine-reasons-section">
                <h3>Fine Reasons</h3>
                <p>You can select multiple reasons.</p>

                {FINE_REASONS.map((reason) => {
                  const selected = formData.amounts[reason] !== undefined;

                  return (
                    <div
                      className={`fine-reason-row ${
                        selected ? "selected" : ""
                      }`}
                      key={reason}
                    >
                      <label className="fine-reason-check">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) =>
                            toggleReason(reason, e.target.checked)
                          }
                        />
                        <span>{reason}</span>
                      </label>

                      {selected && (
                        <div className="fine-amount-input">
                          <span>R</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                            value={formData.amounts[reason]}
                            onChange={(e) =>
                              updateReasonAmount(reason, e.target.value)
                            }
                            placeholder="Amount"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="fine-form-group">
                <label>Notes (Optional)</label>
                <textarea
                  rows="3"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Additional information about these fines..."
                />
              </div>

              <div className="fine-total-preview">
                <span>
                  Total for {selectedReasons.length} selected fine(s)
                </span>
                <strong>{formatCurrency(selectedTotal)}</strong>
              </div>

              <div className="fine-modal-actions">
                <button
                  type="button"
                  className="fine-secondary-button"
                  disabled={saving}
                  onClick={() => {
                    setShowForm(false);
                    setError("");
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="fine-primary-button"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Fines"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record payment modal */}
      {paymentTarget && (
        <div className="fine-modal-backdrop">
          <div className="fine-modal">
            <div className="fine-modal-heading">
              <div>
                <h2>Record Fine Payment</h2>
                <p>
                  {paymentTarget.member?.full_name} — {paymentTarget.reason}
                </p>
              </div>

              <button
                type="button"
                className="fine-close-button"
                onClick={() => {
                  setPaymentTarget(null);
                  setError("");
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="fine-payment-balance">
              <div>
                <span>Original fine</span>
                <strong>{formatCurrency(paymentTarget.fine_amount)}</strong>
              </div>
              <div>
                <span>Already paid</span>
                <strong>{formatCurrency(paymentTarget.total_paid)}</strong>
              </div>
              <div>
                <span>Outstanding</span>
                <strong>
                  {formatCurrency(paymentTarget.outstanding_balance)}
                </strong>
              </div>
            </div>

            <p className="fine-due-note">
              Due date: <strong>{formatDate(paymentTarget.due_date)}</strong>{" "}
              <span
                className={`fine-status-badge ${paymentTarget.payment_status}`}
              >
                {getStatusLabel(paymentTarget.payment_status)}
              </span>
            </p>

            {error && (
              <div className="fines-error" role="alert">
                <AlertTriangle size={18} />
                {error}
              </div>
            )}

            <form onSubmit={handleSavePayment}>
              <div className="fine-form-group">
                <label>Payment Amount (R)</label>
                <input
                  type="number"
                  min="0.01"
                  max={paymentTarget.outstanding_balance}
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      amount: e.target.value,
                    })
                  }
                  placeholder="Enter payment amount"
                />
              </div>

              <div className="fine-form-group">
                <label>Payment Date</label>
                <input
                  type="date"
                  required
                  value={paymentForm.paymentDate}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      paymentDate: e.target.value,
                    })
                  }
                />
              </div>

              <div className="fine-form-group">
                <label>Notes (Optional)</label>
                <textarea
                  rows="3"
                  value={paymentForm.notes}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Payment reference or additional notes"
                />
              </div>

              <div className="fine-modal-actions">
                <button
                  type="button"
                  className="fine-secondary-button"
                  onClick={() => {
                    setPaymentTarget(null);
                    setError("");
                  }}
                  disabled={paymentSaving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="fine-primary-button"
                  disabled={paymentSaving}
                >
                  {paymentSaving ? "Saving..." : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment history modal */}
      {historyFine && (
        <div className="fine-modal-backdrop">
          <div className="fine-modal">
            <div className="fine-modal-heading">
              <div>
                <h2>Fine Payment History</h2>
                <p>
                  {historyFine.member?.full_name} — {historyFine.reason}
                </p>
              </div>

              <button
                type="button"
                className="fine-close-button"
                onClick={() => setHistoryFine(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="fine-payment-balance">
              <div>
                <span>Fine amount</span>
                <strong>{formatCurrency(historyFine.fine_amount)}</strong>
              </div>
              <div>
                <span>Total paid</span>
                <strong>{formatCurrency(historyFine.total_paid)}</strong>
              </div>
              <div>
                <span>Outstanding</span>
                <strong>
                  {formatCurrency(historyFine.outstanding_balance)}
                </strong>
              </div>
            </div>

            <p className="fine-due-note">
              Due date: <strong>{formatDate(historyFine.due_date)}</strong>{" "}
              <span
                className={`fine-status-badge ${historyFine.payment_status}`}
              >
                {getStatusLabel(historyFine.payment_status)}
              </span>
            </p>

            <div className="fine-payment-history-list">
              {getFinePayments(historyFine.fine_id).length === 0 ? (
                <p>No payments have been recorded for this fine.</p>
              ) : (
                getFinePayments(historyFine.fine_id).map((payment) => (
                  <div
                    key={payment.id}
                    className="fine-payment-history-item"
                  >
                    <div>
                      <strong>{formatCurrency(payment.amount)}</strong>
                      <p>{formatDate(payment.payment_date)}</p>
                      {payment.notes && <small>{payment.notes}</small>}
                    </div>
                    <span className="fine-status-badge paid">
                      Payment recorded
                    </span>
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