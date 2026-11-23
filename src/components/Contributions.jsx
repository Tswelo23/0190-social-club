import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Plus,
  Search,
  Wallet,
  Receipt,
  CalendarDays,
  X,
  Pencil,
  Trash2,
} from "lucide-react";

import "./Contributions.css";

const emptyForm = () => ({
  memberId: "",
  amount: "",
  interestContribution: "0",
  contributionDate: new Date().toISOString().slice(0, 10),
  notes: "",
});

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(Number(amount || 0));

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-ZA");
};

function Contributions() {
  const today = new Date();

  const [contributions, setContributions] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [editingContributionId, setEditingContributionId] =
    useState(null);

  const [selectedMonth, setSelectedMonth] = useState(
    String(today.getMonth() + 1)
  );

  const [selectedYear, setSelectedYear] = useState(
    String(today.getFullYear())
  );

  const [formData, setFormData] = useState(emptyForm());

  useEffect(() => {
    loadData();
  }, []);

  // Load contributions and member profiles.
  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const { data: contributionData, error: contributionError } =
        await supabase
          .from("contributions")
          .select(
            "id, member_id, amount, interest_contribution, contribution_date, notes"
          )
          .order("contribution_date", { ascending: false });

      if (contributionError) throw contributionError;

      const { data: memberData, error: memberError } = await supabase
        .from("profiles")
        .select("id, full_name, member_number, account_status")
        .eq("role", "member")
        .order("full_name");

      if (memberError) throw memberError;

      const mappedContributions = (contributionData || []).map(
        (contribution) => {
          const member = (memberData || []).find(
            (profile) => profile.id === contribution.member_id
          );

          return {
            ...contribution,
            profiles: member || null,
          };
        }
      );

      setMembers(memberData || []);
      setContributions(mappedContributions);
    } catch (err) {
      console.error("Error loading contributions:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Only active members can receive new contributions.
  const activeMembers = members.filter(
    (member) => member.account_status === "active"
  );

  // When editing, also allow previously suspended members.
  const formMembers = editingContributionId
    ? members
    : activeMembers;

  // Open a new contribution form.
  const openForm = () => {
    setError("");
    setEditingContributionId(null);
    setFormData(emptyForm());
    setShowForm(true);
  };

  // Open an existing contribution for editing.
  const handleEditContribution = (contribution) => {
    setError("");

    setEditingContributionId(contribution.id);

    setFormData({
      memberId: contribution.member_id,
      amount: String(contribution.amount ?? ""),
      interestContribution: String(
        contribution.interest_contribution ?? 0
      ),
      contributionDate: contribution.contribution_date,
      notes: contribution.notes || "",
    });

    setShowForm(true);
  };

  // Permanently delete a contribution (after confirmation).
  const handleDeleteContribution = async (contribution) => {
    const memberName =
      contribution.profiles?.full_name || "this member";

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete this contribution from ${memberName}?\n\nSavings: ${formatCurrency(
        contribution.amount
      )}\nInterest: ${formatCurrency(
        contribution.interest_contribution
      )}\nDate: ${formatDate(
        contribution.contribution_date
      )}\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setError("");
      setDeletingId(contribution.id);

      // .select("id") returns the deleted rows, so we can detect
      // a delete that was silently blocked by Row Level Security.
      const { data: deletedRows, error: deleteError } = await supabase
        .from("contributions")
        .delete()
        .eq("id", contribution.id)
        .select("id");

      if (deleteError) throw deleteError;

      if (!deletedRows || deletedRows.length === 0) {
        throw new Error(
          "The contribution was not deleted. You may not have permission to delete contributions."
        );
      }

      setContributions((previous) =>
        previous.filter((item) => item.id !== contribution.id)
      );

      alert("Contribution deleted successfully.");
    } catch (err) {
      console.error("Contribution deletion failed:", err);
      setError(err.message || "Unable to delete contribution.");
    } finally {
      setDeletingId(null);
    }
  };

  // Close and reset the form.
  const closeForm = () => {
    if (saving) return;

    setError("");
    setShowForm(false);
    setEditingContributionId(null);
    setFormData(emptyForm());
  };

  // Handle form inputs.
  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // Save a new contribution or update an existing one.
  const handleAddContribution = async (event) => {
    event.preventDefault();
    setError("");

    if (!formData.memberId) {
      setError("Please select a member.");
      return;
    }

    const savingsAmount = Number(formData.amount);
    const interestContribution = Number(
      formData.interestContribution || 0
    );

    if (
      formData.amount === "" ||
      !Number.isFinite(savingsAmount) ||
      savingsAmount <= 0
    ) {
      setError("Savings contribution must be greater than zero.");
      return;
    }

    if (
      !Number.isFinite(interestContribution) ||
      interestContribution < 0
    ) {
      setError("Interest contribution cannot be negative.");
      return;
    }

    if (!formData.contributionDate) {
      setError("Please select a payment date.");
      return;
    }

    setSaving(true);

    try {
      const contributionPayload = {
        member_id: formData.memberId,
        amount: savingsAmount,
        interest_contribution: interestContribution,
        contribution_date: formData.contributionDate,
        notes: formData.notes.trim() || null,
      };

      // UPDATE existing contribution.
      if (editingContributionId) {
        const { data, error: updateError } = await supabase
          .from("contributions")
          .update(contributionPayload)
          .eq("id", editingContributionId)
          .select(
            "id, member_id, amount, interest_contribution, contribution_date, notes"
          )
          .single();

        if (updateError) throw updateError;

        const updatedContribution = {
          ...data,
          profiles:
            members.find(
              (member) => member.id === data.member_id
            ) || null,
        };

        setContributions((previous) =>
          previous
            .map((item) =>
              item.id === editingContributionId
                ? updatedContribution
                : item
            )
            .sort((a, b) =>
              b.contribution_date.localeCompare(a.contribution_date)
            )
        );

        setShowForm(false);
        setEditingContributionId(null);
        setFormData(emptyForm());

        alert("Contribution updated successfully.");
        return;
      }

      // INSERT new contribution.
      const { data, error: insertError } = await supabase
        .from("contributions")
        .insert(contributionPayload)
        .select()
        .single();

      if (insertError) throw insertError;

      setContributions((previous) => [
        {
          ...data,
          profiles:
            members.find(
              (member) => member.id === data.member_id
            ) || null,
        },
        ...previous,
      ]);

      setFormData(emptyForm());
      setShowForm(false);

      alert("Contribution recorded successfully.");
    } catch (err) {
      console.error("Contribution save failed:", err);
      setError(err.message || "Unable to save contribution.");
    } finally {
      setSaving(false);
    }
  };

  // Contributions belonging strictly to the selected year.
  const yearContributions = contributions.filter((item) => {
    const contributionYear = Number(
      (item.contribution_date || "").slice(0, 4)
    );

    return contributionYear === Number(selectedYear);
  });

  // Selected-year totals.
  const totalContributions = yearContributions.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const totalInterestContributions = yearContributions.reduce(
    (sum, item) =>
      sum + Number(item.interest_contribution || 0),
    0
  );

  const totalTransactions = yearContributions.length;

  // Contributions for selected month and year.
  const monthContributions = contributions.filter((item) => {
    const contributionDate = new Date(
      `${item.contribution_date}T00:00:00`
    );

    return (
      contributionDate.getMonth() + 1 === Number(selectedMonth) &&
      contributionDate.getFullYear() === Number(selectedYear)
    );
  });

  // Search selected month's transactions.
  const filteredContributions = monthContributions.filter((item) => {
    const name = item.profiles?.full_name || "";
    const number = item.profiles?.member_number || "";

    return `${name} ${number}`
      .toLowerCase()
      .includes(search.toLowerCase());
  });

  const monthlySavingsTotal = monthContributions.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const monthlyInterestTotal = monthContributions.reduce(
    (sum, item) =>
      sum + Number(item.interest_contribution || 0),
    0
  );

  // Active members without savings contributions in selected month.
  const membersWithoutSavingsContribution = activeMembers.filter(
    (member) =>
      !monthContributions.some(
        (item) =>
          item.member_id === member.id &&
          Number(item.amount) > 0
      )
  );

  const yearOptions = Array.from(
    { length: 5 },
    (_, index) => today.getFullYear() - 2 + index
  );

  return (
    <section className="contributions-page">
      {/* Page heading */}
      <div className="contributions-heading">
        <div>
          <span className="eyebrow">FINANCIAL MANAGEMENT</span>
          <h1>Contributions</h1>
          <p>Manage and monitor member savings contributions.</p>
        </div>

        <button
          className="add-contribution-button"
          onClick={openForm}
        >
          <Plus size={18} />
          Record Contribution
        </button>
      </div>

      {/* Statistics (selected year) */}
      <div className="contribution-stats">
        <div className="contribution-stat-tile">
          <div className="contribution-stat-icon">
            <Wallet size={22} />
          </div>

          <div>
            <p>Total Savings Contributions ({selectedYear})</p>
            <h2>{formatCurrency(totalContributions)}</h2>
          </div>
        </div>

        <div className="contribution-stat-tile">
          <div className="contribution-stat-icon">
            <Receipt size={22} />
          </div>

          <div>
            <p>Total Interest Contributions ({selectedYear})</p>
            <h2>{formatCurrency(totalInterestContributions)}</h2>
          </div>
        </div>

        <div className="contribution-stat-tile">
          <div className="contribution-stat-icon">
            <CalendarDays size={22} />
          </div>

          <div>
            <p>Total Transactions ({selectedYear})</p>
            <h2>{totalTransactions}</h2>
          </div>
        </div>
      </div>

      {error && !showForm && (
        <div className="contribution-error" role="alert">
          {error}
        </div>
      )}

      {/* Month and year filters */}
      <div className="contribution-filters">
        <div className="contribution-filter-group">
          <label>Month</label>

          <select
            value={selectedMonth}
            onChange={(event) =>
              setSelectedMonth(event.target.value)
            }
          >
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {new Date(2000, index).toLocaleString("en-ZA", {
                  month: "long",
                })}
              </option>
            ))}
          </select>
        </div>

        <div className="contribution-filter-group">
          <label>Year</label>

          <select
            value={selectedYear}
            onChange={(event) =>
              setSelectedYear(event.target.value)
            }
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Monthly totals */}
      <div className="monthly-summary">
        <div>
          <span>Monthly Savings Contributions</span>
          <h3>{formatCurrency(monthlySavingsTotal)}</h3>
        </div>

        <div>
          <span>Monthly Interest Contributions</span>
          <h3>{formatCurrency(monthlyInterestTotal)}</h3>
        </div>
      </div>

      {/* Members without contributions */}
      {!loading && (
        <div className="contribution-status">
          <h3>Members Without Savings Contributions</h3>

          {membersWithoutSavingsContribution.length === 0 ? (
            <p>
              All active members have recorded savings contributions
              this month.
            </p>
          ) : (
            <ul>
              {membersWithoutSavingsContribution.map((member) => (
                <li key={member.id}>
                  {member.full_name} (
                  {member.member_number || "No number"})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Payment history */}
      <div className="contribution-table-panel">
        <div className="contribution-table-header">
          <div>
            <h3>Payment History</h3>
            <p>Contributions recorded for the selected month</p>
          </div>

          <div className="contribution-search">
            <Search size={18} />

            <input
              type="text"
              placeholder="Search members..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <p className="contribution-message">
            Loading contributions...
          </p>
        ) : (
          <div className="contribution-table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Member Number</th>
                  <th>Contribution Date</th>
                  <th>Savings Contribution</th>
                  <th>Interest Contribution</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredContributions.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.profiles?.full_name || "Unknown Member"}
                    </td>

                    <td>
                      {item.profiles?.member_number || "—"}
                    </td>

                    <td>{formatDate(item.contribution_date)}</td>

                    <td className="contribution-amount">
                      {formatCurrency(item.amount)}
                    </td>

                    <td className="contribution-amount">
                      {formatCurrency(item.interest_contribution)}
                    </td>

                    <td>{item.notes || "—"}</td>

                    <td>
                      <div className="contribution-actions">
                        <button
                          type="button"
                          className="edit-contribution-button"
                          title="Edit contribution"
                          aria-label="Edit contribution"
                          onClick={() =>
                            handleEditContribution(item)
                          }
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          className="delete-contribution-button"
                          title="Delete contribution"
                          aria-label="Delete contribution"
                          disabled={deletingId === item.id}
                          onClick={() =>
                            handleDeleteContribution(item)
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredContributions.length === 0 && (
                  <tr>
                    <td colSpan="7" className="contribution-empty">
                      No contributions found for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Contribution Modal */}
      {showForm && (
        <div className="contribution-modal-backdrop">
          <div className="contribution-modal">
            <div className="contribution-modal-header">
              <div>
                <h2>
                  {editingContributionId
                    ? "Edit Contribution"
                    : "Record Contribution"}
                </h2>

                <p>
                  {editingContributionId
                    ? "Update the existing payment details."
                    : "Enter the member's payment details."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                aria-label="Close form"
                disabled={saving}
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={handleAddContribution}>
              <label>Member</label>

              <select
                name="memberId"
                value={formData.memberId}
                onChange={handleInputChange}
                required
              >
                <option value="">Select a member</option>

                {formMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name} (
                    {member.member_number || "No number"})
                    {member.account_status === "disabled"
                      ? " - Suspended"
                      : ""}
                  </option>
                ))}
              </select>

              <label>Savings Contribution (R)</label>

              <input
                type="number"
                name="amount"
                min="0.01"
                step="0.01"
                placeholder="Enter any amount"
                value={formData.amount}
                onChange={handleInputChange}
                required
              />

              <label>Interest Contribution (R)</label>

              <input
                type="number"
                name="interestContribution"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formData.interestContribution}
                onChange={handleInputChange}
              />

              <label>Payment Date</label>

              <div className="contribution-date-input">
                <CalendarDays size={18} />

                <input
                  type="date"
                  name="contributionDate"
                  value={formData.contributionDate}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <label>Notes (Optional)</label>

              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Additional payment information"
                rows="3"
              />

              {error && (
                <div className="contribution-error" role="alert">
                  {error}
                </div>
              )}

              <div className="contribution-form-actions">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button type="submit" disabled={saving}>
                  {saving
                    ? "Saving..."
                    : editingContributionId
                      ? "Update Contribution"
                      : "Save Contribution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default Contributions;