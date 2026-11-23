
import { useEffect, useState } from "react";
import {
  Users,
  Search,
  Plus,
  X,
  Mail,
  CalendarDays,
  Eye,
  Pencil,
  UserCheck,
  UserX,
  Trash2,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import "./Members.css";

function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [editingMemberId, setEditingMemberId] = useState(null);

  // Supports suspend, reactivate and delete actions.
  const [pendingAction, setPendingAction] = useState(null);

  const emptyForm = () => ({
    fullName: "",
    email: "",
    memberNumber: "",
    joinedAt: new Date().toISOString().slice(0, 10),
  });

  const [formData, setFormData] = useState(emptyForm());

  // Format Supabase profile data.
  const formatMember = (profile) => ({
    id: profile.id,
    fullName: profile.full_name || "",
    email: profile.email || "",
    memberNumber: profile.member_number || "Not assigned",
    joinedAt: profile.joined_at || "",
    membershipStatus: profile.membership_status || "active",
    accountStatus: profile.account_status || "active",
    role: profile.role || "member",
  });

  // Load all members.
  const loadMembers = async () => {
    setLoading(true);
    setLoadError("");

    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        full_name,
        email,
        member_number,
        joined_at,
        membership_status,
        account_status,
        role
      `)
      .eq("role", "member")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Member retrieval error:", error);
      setLoadError(error.message);
      setMembers([]);
    } else {
      setMembers((data || []).map(formatMember));
    }

    setLoading(false);
  };

  useEffect(() => {
    loadMembers();
  }, []);

  // Member status checks.
  const isSuspended = (member) =>
    member.accountStatus?.toLowerCase() === "disabled";

  const isActive = (member) =>
    member.membershipStatus?.toLowerCase() === "active" &&
    member.accountStatus?.toLowerCase() === "active";

  // Dashboard statistics.
  const activeMembers = members.filter(isActive).length;
  const suspendedMembers = members.filter(isSuspended).length;

  // Search and filter members.
  const filteredMembers = members.filter((member) => {
    const searchMatches = [
      member.fullName,
      member.email,
      member.memberNumber,
    ].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    );

    let statusMatches = true;

    if (statusFilter === "active") {
      statusMatches = isActive(member);
    } else if (statusFilter === "suspended") {
      statusMatches = isSuspended(member);
    }

    return searchMatches && statusMatches;
  });

  // Handle form inputs.
  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // Close the add/edit form.
  const closeForm = () => {
    setShowForm(false);
    setEditingMemberId(null);
    setFormError("");
    setFormData(emptyForm());
  };

  // Open edit form.
  const handleEditMember = (member) => {
    setEditingMemberId(member.id);
    setFormError("");

    setFormData({
      fullName: member.fullName,
      email: member.email,
      memberNumber:
        member.memberNumber === "Not assigned"
          ? ""
          : member.memberNumber,
      joinedAt: member.joinedAt,
    });

    setSelectedMember(null);
    setShowForm(true);
  };

  // Add or update a member.
  const handleAddMember = async (event) => {
    event.preventDefault();
    setFormError("");

    const fullName = formData.fullName.trim();
    const email = formData.email.trim().toLowerCase();
    const memberNumber = formData.memberNumber.trim();

    if (!fullName || !email || !memberNumber || !formData.joinedAt) {
      setFormError("Please complete all required fields.");
      return;
    }

    setSaving(true);

    try {
      // Update existing member.
      if (editingMemberId) {
        const duplicateNumber = members.some(
          (member) =>
            member.id !== editingMemberId &&
            member.memberNumber.toLowerCase() ===
              memberNumber.toLowerCase()
        );

        if (duplicateNumber) {
          throw new Error("This member number already exists.");
        }

        const { data, error } = await supabase
          .from("profiles")
          .update({
            full_name: fullName,
            email,
            member_number: memberNumber,
            joined_at: formData.joinedAt,
          })
          .eq("id", editingMemberId)
          .select(`
            id,
            full_name,
            email,
            member_number,
            joined_at,
            membership_status,
            account_status,
            role
          `)
          .single();

        if (error) throw error;

        const updatedMember = formatMember(data);

        setMembers((previous) =>
          previous.map((member) =>
            member.id === editingMemberId ? updatedMember : member
          )
        );

        closeForm();
        alert("Member updated successfully.");
        return;
      }

      // Check for duplicate member numbers.
      const duplicateNumber = members.some(
        (member) =>
          member.memberNumber.toLowerCase() ===
          memberNumber.toLowerCase()
      );

      if (duplicateNumber) {
        throw new Error("This member number already exists.");
      }

      // Create member through the protected Edge Function.
      const { data, error } = await supabase.functions.invoke(
        "create-member",
        {
          body: {
            fullName,
            email,
            memberNumber,
            joinedAt: formData.joinedAt,
          },
        }
      );

      if (error) {
        let message = error.message;

        if (error.context instanceof Response) {
          try {
            const details = await error.context.json();
            message = details.error || message;
          } catch {
            // Keep the original error message.
          }
        }

        throw new Error(message);
      }

      if (!data?.member) {
        throw new Error(
          "The server did not return the member profile."
        );
      }

      setMembers((previous) => [
        formatMember(data.member),
        ...previous,
      ]);

      closeForm();
      alert(data.message || "Member successfully registered.");
    } catch (error) {
      console.error("Member save failed:", error);
      setFormError(error.message || "Unable to save member.");
    } finally {
      setSaving(false);
    }
  };

  // Open action confirmation.
  const openActionConfirmation = (member, action) => {
    setActionError("");
    setPendingAction({ member, action });
  };

  // Close action confirmation.
  const closeActionConfirmation = () => {
    if (actionLoading) return;

    setPendingAction(null);
    setActionError("");
  };

  // Execute member actions.
  const executeMemberAction = async () => {
    if (!pendingAction) return;

    const { member, action } = pendingAction;

    setActionLoading(true);
    setActionError("");

    try {
      // Suspend member.
      if (action === "suspend") {
        const { error } = await supabase
          .from("profiles")
          .update({ account_status: "disabled" })
          .eq("id", member.id)
          .eq("role", "member");

        if (error) throw error;

        setMembers((previous) =>
          previous.map((item) =>
            item.id === member.id
              ? { ...item, accountStatus: "disabled" }
              : item
          )
        );

        if (selectedMember?.id === member.id) {
          setSelectedMember((previous) => ({
            ...previous,
            accountStatus: "disabled",
          }));
        }

        alert(`${member.fullName} has been suspended.`);
      }

      // Reactivate member.
      if (action === "reactivate") {
        const { error } = await supabase
          .from("profiles")
          .update({ account_status: "active" })
          .eq("id", member.id)
          .eq("role", "member");

        if (error) throw error;

        setMembers((previous) =>
          previous.map((item) =>
            item.id === member.id
              ? { ...item, accountStatus: "active" }
              : item
          )
        );

        if (selectedMember?.id === member.id) {
          setSelectedMember((previous) => ({
            ...previous,
            accountStatus: "active",
          }));
        }

        alert(`${member.fullName} has been reactivated.`);
      }

      // Permanently delete member through protected Edge Function.
      if (action === "delete") {
        const { data, error } = await supabase.functions.invoke(
          "delete-member",
          {
            body: { memberId: member.id },
          }
        );

        if (error) {
          let message = error.message;

          if (error.context instanceof Response) {
            try {
              const details = await error.context.json();
              message = details.error || message;
            } catch {
              // Keep the original error.
            }
          }

          throw new Error(message);
        }

        if (!data?.success) {
          throw new Error(
            data?.error || "The member could not be deleted."
          );
        }

        setMembers((previous) =>
          previous.filter((item) => item.id !== member.id)
        );

        if (selectedMember?.id === member.id) {
          setSelectedMember(null);
        }

        alert("Member permanently deleted.");
      }

      setPendingAction(null);
    } catch (error) {
      console.error("Member action failed:", error);
      setActionError(error.message || "Unable to complete this action.");
    } finally {
      setActionLoading(false);
    }
  };

  // Confirmation modal content.
  const getActionContent = () => {
    if (!pendingAction) return null;

    const { member, action } = pendingAction;

    const content = {
      suspend: {
        title: "Suspend Member?",
        message: `This will disable ${member.fullName}'s login access. Their membership and financial history will remain unchanged.`,
        button: "Suspend Member",
      },
      reactivate: {
        title: "Reactivate Member?",
        message: `This will restore ${member.fullName}'s login access.`,
        button: "Reactivate Member",
      },
      delete: {
        title: "Permanently Delete Member?",
        message: `You are requesting permanent deletion of ${member.fullName}. This is only allowed if the member has no financial transactions or outstanding balances. This cannot be undone.`,
        button: "Permanently Delete",
      },
    };

    return content[action];
  };

  const actionContent = getActionContent();

  return (
    <div className="members-page">
      {/* Page heading */}
      <section className="members-heading">
        <div>
          <span className="eyebrow">MEMBER MANAGEMENT</span>
          <h1>Club Members</h1>
          <p>
            Register members and manage their account access.
          </p>
        </div>

        <button
          className="add-member-button"
          onClick={() => {
            setEditingMemberId(null);
            setFormError("");
            setFormData(emptyForm());
            setShowForm(true);
          }}
        >
          <Plus size={18} />
          Add New Member
        </button>
      </section>

      {/* Member statistics */}
      <section className="member-statistics">
        <div className="member-stat-card">
          <div className="member-stat-icon blue">
            <Users size={21} />
          </div>

          <div>
            <span>Total Members</span>
            <h2>{members.length}</h2>
          </div>
        </div>

        <div className="member-stat-card">
          <div className="member-stat-icon green">
            <UserCheck size={21} />
          </div>

          <div>
            <span>Active Members</span>
            <h2>{activeMembers}</h2>
          </div>
        </div>

        <div className="member-stat-card">
          <div className="member-stat-icon orange">
            <UserX size={21} />
          </div>

          <div>
            <span>Suspended Members</span>
            <h2>{suspendedMembers}</h2>
          </div>
        </div>
      </section>

      {/* Member directory */}
      <section className="members-panel">
        <div className="members-panel-header">
          <div>
            <h3>Member Directory</h3>
            <p>Manage active and suspended club members.</p>
          </div>

          <div className="member-search">
            <Search size={18} />

            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="member-filter-tabs">
          {[
            { value: "all", label: "All Members" },
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
          ].map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={
                statusFilter === filter.value ? "active" : ""
              }
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Members table */}
        <div className="members-table-wrapper">
          <table className="members-table">
            <thead>
              <tr>
                <th>MEMBER</th>
                <th>MEMBER NUMBER</th>
                <th>JOINING DATE</th>
                <th>MEMBERSHIP</th>
                <th>ACCOUNT</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan="6" className="empty-members">
                    Loading members from Supabase...
                  </td>
                </tr>
              )}

              {loadError && (
                <tr>
                  <td colSpan="6" className="empty-members">
                    Unable to load members: {loadError}
                  </td>
                </tr>
              )}

              {!loading &&
                !loadError &&
                filteredMembers.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="directory-member">
                        <div className="directory-avatar">
                          {member.fullName
                            .split(" ")
                            .map((word) => word[0])
                            .join("")
                            .slice(0, 2)}
                        </div>

                        <div>
                          <strong>{member.fullName}</strong>
                          <span>{member.email}</span>
                        </div>
                      </div>
                    </td>

                    <td className="member-number-cell">
                      {member.memberNumber}
                    </td>

                    <td>{member.joinedAt || "—"}</td>

                    <td>
                      <span
                        className={`member-status ${member.membershipStatus.toLowerCase()}`}
                      >
                        {member.membershipStatus}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`member-status ${member.accountStatus.toLowerCase()}`}
                      >
                        {member.accountStatus}
                      </span>
                    </td>

                    <td>
                      <div className="member-actions">
                        {/* View member */}
                        <button
                          title="View member"
                          aria-label="View member"
                          onClick={() => setSelectedMember(member)}
                        >
                          <Eye size={17} />
                        </button>

                        {/* Edit member */}
                        <button
                          title="Edit member"
                          aria-label="Edit member"
                          onClick={() => handleEditMember(member)}
                        >
                          <Pencil size={17} />
                        </button>

                        {/* Suspend active member */}
                        {isActive(member) && (
                          <button
                            title="Suspend member"
                            aria-label={`Suspend ${member.fullName}`}
                            onClick={() =>
                              openActionConfirmation(member, "suspend")
                            }
                          >
                            <UserX size={17} />
                          </button>
                        )}

                        {/* Reactivate suspended member */}
                        {isSuspended(member) && (
                          <button
                            title="Reactivate member"
                            aria-label={`Reactivate ${member.fullName}`}
                            onClick={() =>
                              openActionConfirmation(member, "reactivate")
                            }
                          >
                            <RotateCcw size={17} />
                          </button>
                        )}

                        {/* Permanently delete member */}
                        <button
                          className="delete-member-action"
                          title="Permanently delete member"
                          aria-label={`Delete ${member.fullName}`}
                          onClick={() =>
                            openActionConfirmation(member, "delete")
                          }
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading &&
                !loadError &&
                filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan="6" className="empty-members">
                      No members found.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add / Edit Member Modal */}
      {showForm && (
        <div className="member-modal-overlay" onClick={closeForm}>
          <div
            className="member-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="member-modal-header">
              <div>
                <h2>
                  {editingMemberId ? "Edit Member" : "Add New Member"}
                </h2>
                <p>Enter the member's registration information.</p>
              </div>

              <button
                className="modal-close"
                onClick={closeForm}
                aria-label="Close form"
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={handleAddMember}>
              <div className="member-form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  name="fullName"
                  placeholder="Enter full name"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="member-form-group">
                <label>Email Address</label>

                <div className="member-input-icon">
                  <Mail size={18} />

                  <input
                    type="email"
                    name="email"
                    placeholder="Enter email address"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="member-form-group">
                <label>Member Number</label>
                <input
                  type="text"
                  name="memberNumber"
                  placeholder="e.g. 0190-001"
                  value={formData.memberNumber}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="member-form-group">
                <label>Joining Date</label>

                <div className="member-input-icon">
                  <CalendarDays size={18} />

                  <input
                    type="date"
                    name="joinedAt"
                    value={formData.joinedAt}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              {!editingMemberId && (
                <div className="member-default-info">
                  <strong>Default account settings</strong>
                  <span>Role: Member</span>
                  <span>Membership: Active</span>
                  <span>Account: Active</span>

                  <small>
                    Members receive an email invitation to set up their
                    own login password.
                  </small>
                </div>
              )}

              {formError && (
                <div className="member-form-error" role="alert">
                  {formError}
                </div>
              )}

              <div className="member-form-actions">
                <button
                  type="button"
                  className="cancel-member-button"
                  onClick={closeForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-member-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingMemberId
                      ? "Update Member"
                      : "Save Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Member Modal */}
      {selectedMember && (
        <div
          className="member-modal-overlay"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="member-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="member-modal-header">
              <div>
                <h2>Member Details</h2>
                <p>Membership information and account status.</p>
              </div>

              <button
                className="modal-close"
                onClick={() => setSelectedMember(null)}
                aria-label="Close details"
              >
                <X size={21} />
              </button>
            </div>

            <div className="member-default-info">
              <strong>Personal Information</strong>
              <span>Full name: {selectedMember.fullName}</span>
              <span>Email: {selectedMember.email}</span>
              <span>Member number: {selectedMember.memberNumber}</span>
              <span>Joining date: {selectedMember.joinedAt || "—"}</span>
            </div>

            <div className="member-default-info">
              <strong>Account Information</strong>
              <span>
                Membership: {selectedMember.membershipStatus}
              </span>
              <span>Account: {selectedMember.accountStatus}</span>
              <span>Role: {selectedMember.role}</span>
            </div>

            <div className="member-form-actions">
              <button
                type="button"
                className="cancel-member-button"
                onClick={() => setSelectedMember(null)}
              >
                Close
              </button>

              <button
                type="button"
                className="save-member-button"
                onClick={() => handleEditMember(selectedMember)}
              >
                <Pencil size={15} />
                Edit Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {pendingAction && actionContent && (
        <div
          className="member-modal-overlay"
          onClick={closeActionConfirmation}
        >
          <div
            className="member-delete-modal"
            role="alertdialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="delete-warning-icon">
              <AlertTriangle size={27} />
            </div>

            <h2>{actionContent.title}</h2>

            <p>{actionContent.message}</p>

            <div className="delete-member-details">
              <span>Member</span>
              <strong>{pendingAction.member.fullName}</strong>

              <span>Member number</span>
              <strong>{pendingAction.member.memberNumber}</strong>

              <span>Email address</span>
              <strong>{pendingAction.member.email}</strong>
            </div>

            {pendingAction.action === "delete" && (
              <p className="delete-warning-text">
                Members with financial history or outstanding balances
                cannot be permanently deleted. Suspend their account if
                they should no longer have login access.
              </p>
            )}

            {actionError && (
              <div className="member-form-error" role="alert">
                {actionError}
              </div>
            )}

            <div className="member-form-actions">
              <button
                type="button"
                className="cancel-member-button"
                onClick={closeActionConfirmation}
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className={
                  pendingAction.action === "delete"
                    ? "confirm-delete-button"
                    : "save-member-button"
                }
                onClick={executeMemberAction}
                disabled={actionLoading}
              >
                {pendingAction.action === "delete" ? (
                  <Trash2 size={15} />
                ) : pendingAction.action === "reactivate" ? (
                  <UserCheck size={15} />
                ) : (
                  <UserX size={15} />
                )}

                {actionLoading ? "Please wait..." : actionContent.button}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Members;
