import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  Plus,
  Search,
  Wallet,
  Receipt,
  CalendarDays,
  X
} from "lucide-react";

import "./Contributions.css";

const emptyForm = () => ({
  memberId: "",
  amount: "",
  interestContribution: "0",
  contributionDate: new Date().toISOString().slice(0, 10),
  notes: ""
});

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR"
  }).format(Number(amount || 0));

// Parse "YYYY-MM-DD" as a local date to avoid timezone shifts
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
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

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

      // All member profiles, so past payments from disabled members still show names
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
            profiles: member || null
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

  // Only active members can receive new contributions
  const activeMembers = members.filter(
    (member) => member.account_status === "active"
  );

  const openForm = () => {
    setError("");
    setFormData(emptyForm());
    setShowForm(true);
  };

  const closeForm = () => {
    setError("");
    setShowForm(false);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const handleAddContribution = async (event) => {
    event.preventDefault();

    setError("");

    if (!formData.memberId) {
      setError("Please select a member.");
      return;
    }

    if (formData.amount === "" || Number(formData.amount) <= 0) {
      setError("Savings contribution must be greater than zero.");
      return;
    }

    const interestContribution = Number(formData.interestContribution || 0);

    if (!Number.isFinite(interestContribution) || interestContribution < 0) {
      setError("Interest contribution cannot be negative.");
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from("contributions")
        .insert({
          member_id: formData.memberId,
          amount: Number(formData.amount),
          interest_contribution: interestContribution,
          contribution_date: formData.contributionDate,
          notes: formData.notes.trim() || null
        })
        .select()
        .single();

      if (error) throw error;

      setContributions((previous) => [
        {
          ...data,
          profiles:
            members.find((member) => member.id === data.member_id) || null
        },
        ...previous
      ]);

      setFormData(emptyForm());
      setShowForm(false);
    } catch (err) {
      console.error("Contribution creation failed:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // All-time totals (summary tiles)
  const totalContributions = contributions.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const totalInterestContributions = contributions.reduce(
    (sum, item) => sum + Number(item.interest_contribution || 0),
    0
  );

  const totalTransactions = contributions.length;

  // Contributions in the selected month and year (ignores the search box)
  const monthContributions = contributions.filter((item) => {
    const contributionDate = new Date(`${item.contribution_date}T00:00:00`);

    return (
      contributionDate.getMonth() + 1 === Number(selectedMonth) &&
      contributionDate.getFullYear() === Number(selectedYear)
    );
  });

  // Table rows: selected month and year, narrowed by the search box
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
    (sum, item) => sum + Number(item.interest_contribution || 0),
    0
  );

  // Active members with no savings contribution in the selected month
  const membersWithoutSavingsContribution = activeMembers.filter(
    (member) =>
      !monthContributions.some(
        (item) =>
          item.member_id === member.id && Number(item.amount) > 0
      )
  );

  const yearOptions = Array.from(
    { length: 5 },
    (_, index) => today.getFullYear() - 2 + index
  );

  return (
    <section className="contributions-page">

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

      <div className="contribution-stats">

        <div className="contribution-stat-tile">
          <div className="contribution-stat-icon">
            <Wallet size={22} />
          </div>
          <div>
            <p>Total Savings Contributions</p>
            <h2>{formatCurrency(totalContributions)}</h2>
          </div>
        </div>

        <div className="contribution-stat-tile">
          <div className="contribution-stat-icon">
            <Receipt size={22} />
          </div>
          <div>
            <p>Total Interest Contributions</p>
            <h2>{formatCurrency(totalInterestContributions)}</h2>
          </div>
        </div>

        <div className="contribution-stat-tile">
          <div className="contribution-stat-icon">
            <CalendarDays size={22} />
          </div>
          <div>
            <p>Total Transactions</p>
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
            onChange={(event) => setSelectedMonth(event.target.value)}
          >
            {Array.from({ length: 12 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {new Date(2000, index).toLocaleString("en-ZA", {
                  month: "long"
                })}
              </option>
            ))}
          </select>
        </div>

        <div className="contribution-filter-group">
          <label>Year</label>
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
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

      {/* Members who have not contributed this month */}
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
                  {member.full_name} ({member.member_number || "No number"})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
          <p className="contribution-message">Loading contributions...</p>
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
                </tr>
              </thead>

              <tbody>
                {filteredContributions.map((item) => (
                  <tr key={item.id}>
                    <td>{item.profiles?.full_name || "Unknown Member"}</td>
                    <td>{item.profiles?.member_number || "—"}</td>
                    <td>{formatDate(item.contribution_date)}</td>
                    <td className="contribution-amount">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="contribution-amount">
                      {formatCurrency(item.interest_contribution)}
                    </td>
                    <td>{item.notes || "—"}</td>
                  </tr>
                ))}

                {filteredContributions.length === 0 && (
                  <tr>
                    <td colSpan="6" className="contribution-empty">
                      No contributions found for this month.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {showForm && (
        <div className="contribution-modal-backdrop">
          <div className="contribution-modal">

            <div className="contribution-modal-header">
              <div>
                <h2>Record Contribution</h2>
                <p>Enter the member's payment details.</p>
              </div>

              <button
                type="button"
                onClick={closeForm}
                aria-label="Close form"
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

                {activeMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.full_name} ({member.member_number || "No number"})
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
                <button type="button" onClick={closeForm}>
                  Cancel
                </button>

                <button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Contribution"}
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