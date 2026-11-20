
import { useEffect, useState } from "react";
import {
  UserRound,
  Wallet,
  Percent,
  Receipt,
  RefreshCw,
  CalendarDays,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import "./MemberFinancialStatement.css";

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(Number(amount || 0));

export default function MemberFinancialStatement() {
  const [members, setMembers] = useState([]);
  const [selectedMember, setSelectedMember] = useState("");
  const [summary, setSummary] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load all member profiles, including disabled members,
  // so administrators can still access their financial history.
  useEffect(() => {
    const loadMembers = async () => {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, member_number, account_status")
          .eq("role", "member")
          .order("full_name");

        if (error) throw error;

        setMembers(data || []);

        if (data?.length) {
          setSelectedMember(data[0].id);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, []);

  // Load the selected member's financial summary and history.
  useEffect(() => {
    if (!selectedMember) {
      setSummary(null);
      setContributions([]);
      return;
    }

    const loadStatement = async () => {
      try {
        setLoading(true);
        setError("");

        const [summaryResult, contributionResult] =
          await Promise.all([
            supabase
              .from("member_financial_summary")
              .select("*")
              .eq("member_id", selectedMember)
              .maybeSingle(),

            supabase
              .from("contributions")
              .select(
                "id, amount, interest_contribution, contribution_date, notes"
              )
              .eq("member_id", selectedMember)
              .order("contribution_date", { ascending: false }),
          ]);

        if (summaryResult.error) throw summaryResult.error;
        if (contributionResult.error) throw contributionResult.error;

        setSummary(summaryResult.data);
        setContributions(contributionResult.data || []);
      } catch (err) {
        console.error("Financial statement error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadStatement();
  }, [selectedMember]);

  const selectedProfile = members.find(
    (member) => member.id === selectedMember
  );

  if (loading && members.length === 0) {
    return <div className="statement-loading">Loading members...</div>;
  }

  return (
    <div className="member-statement">
      <div className="statement-heading">
        <div>
          <span className="statement-eyebrow">
            FINANCIAL MANAGEMENT
          </span>
          <h1>Member Financial Statements</h1>
          <p>Review individual member financial positions and history.</p>
        </div>

        <div className="statement-icon">
          <Receipt size={25} />
        </div>
      </div>

      <div className="statement-selector">
        <label htmlFor="statement-member">
          Select Member
        </label>

        <select
          id="statement-member"
          value={selectedMember}
          onChange={(e) => setSelectedMember(e.target.value)}
        >
          <option value="">Choose a member</option>

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

      {error && (
        <div className="statement-error">
          {error}
        </div>
      )}

      {!selectedMember && !loading && (
        <div className="statement-empty">
          No members are available.
        </div>
      )}

      {selectedMember && (
        <>
          <div className="statement-member-info">
            <div className="member-avatar">
              <UserRound size={25} />
            </div>

            <div>
              <h2>
                {selectedProfile?.full_name || "Member"}
              </h2>
              <p>
                Member Number:{" "}
                {selectedProfile?.member_number || "—"}
              </p>
            </div>

            {selectedProfile?.account_status === "disabled" && (
              <span className="disabled-label">Disabled account</span>
            )}
          </div>

          {loading ? (
            <div className="statement-loading">
              Loading financial statement...
            </div>
          ) : (
            <>
              <div className="statement-cards">
                <div className="statement-card">
                  <Wallet size={23} />
                  <p>Total Savings Contributions</p>
                  <h3>
                    {formatCurrency(summary?.total_contributions)}
                  </h3>
                </div>

                <div className="statement-card">
                  <Percent size={23} />
                  <p>Total Interest Contributions</p>
                  <h3>
                    {formatCurrency(summary?.total_interest)}
                  </h3>
                </div>

                <div className="statement-card">
                  <Receipt size={23} />
                  <p>Other Payments</p>
                  <h3>
                    {formatCurrency(summary?.total_other_payments)}
                  </h3>
                </div>

                <div className="statement-card">
                  <RefreshCw size={23} />
                  <p>Outstanding Loans</p>
                  <h3>
                    {formatCurrency(summary?.outstanding_loans)}
                  </h3>
                </div>
              </div>

              <div className="statement-cards secondary-cards">
                <div className="statement-card">
                  <p>Total Fines</p>
                  <h3>{formatCurrency(summary?.total_fines)}</h3>
                </div>

                <div className="statement-card">
                  <p>Total Loans Issued</p>
                  <h3>{formatCurrency(summary?.total_loans)}</h3>
                </div>

                <div className="statement-card">
                  <p>Total Loan Repayments</p>
                  <h3>
                    {formatCurrency(summary?.total_loan_repayments)}
                  </h3>
                </div>
              </div>

              <section className="statement-history">
                <div className="history-heading">
                  <div>
                    <h2>Contribution History</h2>
                    <p>All savings and interest contribution transactions</p>
                  </div>
                  <CalendarDays size={23} />
                </div>

                <div className="statement-table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Savings Contribution</th>
                        <th>Interest Contribution</th>
                        <th>Notes</th>
                      </tr>
                    </thead>

                    <tbody>
                      {contributions.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="empty-row">
                            No contribution records found.
                          </td>
                        </tr>
                      ) : (
                        contributions.map((item) => (
                          <tr key={item.id}>
                            <td>
                              {new Date(
                                `${item.contribution_date}T00:00:00`
                              ).toLocaleDateString("en-ZA")}
                            </td>
                            <td>{formatCurrency(item.amount)}</td>
                            <td>
                              {formatCurrency(item.interest_contribution)}
                            </td>
                            <td>{item.notes || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
