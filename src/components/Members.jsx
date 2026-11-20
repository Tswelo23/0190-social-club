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
  AlertTriangle
} from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import "./Members.css";

function Members() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [memberToDelete, setMemberToDelete] = useState(null);

  useEffect(() => {
    let ignore = false;

    const fetchMembers = async () => {
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
        .order("created_at", { ascending: false });

      if (ignore) return;

      if (error) {
        console.error("Member retrieval error:", error);
        setLoadError(error.message);
        setMembers([]);
      } else {
        const formattedMembers = (data || []).map((profile) => ({
          id: profile.id,
          fullName: profile.full_name || "",
          email: profile.email || "",
          memberNumber: profile.member_number || "Not assigned",
          joinedAt: profile.joined_at || "",
          membershipStatus: profile.membership_status
            ? profile.membership_status.charAt(0).toUpperCase() +
              profile.membership_status.slice(1)
            : "Unknown",
          accountStatus: profile.account_status
            ? profile.account_status.charAt(0).toUpperCase() +
              profile.account_status.slice(1)
            : "Unknown",
          role: profile.role
        }));

        setMembers(formattedMembers);
      }

      setLoading(false);
    };

    fetchMembers();

    return () => {
      ignore = true;
    };
  }, []);

  const emptyForm = () => ({
    fullName: "",
    email: "",
    memberNumber: "",
    joinedAt: new Date().toISOString().slice(0, 10)
  });

  const [formData, setFormData] = useState(emptyForm());

  const filteredMembers = members.filter((member) =>
    [
      member.fullName,
      member.email,
      member.memberNumber
    ].some((value) =>
      value.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value
    }));
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingMemberId(null);
    setFormError("");
    setFormData(emptyForm());
  };

  const handleEditMember = (member) => {
    setEditingMemberId(member.id);
    setFormError("");

    setFormData({
      fullName: member.fullName,
      email: member.email,
      memberNumber: member.memberNumber,
      joinedAt: member.joinedAt
    });

    setSelectedMember(null);
    setShowForm(true);
  };

  const handleAddMember = async (event) => {
    event.preventDefault();

    setFormError("");

   if (editingMemberId !== null) {
  setSaving(true);

  try {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        member_number: formData.memberNumber.trim(),
        joined_at: formData.joinedAt
      })
      .eq("id", editingMemberId)
      .select()
      .single();

    if (error) throw error;

    const updatedMember = {
      id: data.id,
      fullName: data.full_name,
      email: data.email,
      memberNumber: data.member_number,
      joinedAt: data.joined_at,
      membershipStatus: data.membership_status,
      accountStatus: data.account_status,
      role: data.role
    };

    setMembers((previous) =>
      previous.map((member) =>
        member.id === editingMemberId ? updatedMember : member
      )
    );

    closeForm();
    alert("Member updated successfully.");
  } catch (error) {
    console.error("Member update failed:", error);
    setFormError(error.message || "Unable to update member.");
  } finally {
    setSaving(false);
  }

  return;
}

    const duplicateNumber = members.some(
      (member) =>
        member.memberNumber.toLowerCase() ===
        formData.memberNumber.trim().toLowerCase()
    );

    if (duplicateNumber) {
      setFormError("This member number already exists.");
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-member",
        {
          body: {
            fullName: formData.fullName.trim(),
            email: formData.email.trim().toLowerCase(),
            memberNumber: formData.memberNumber.trim(),
            joinedAt: formData.joinedAt
          }
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
        throw new Error("The server did not return the member profile.");
      }

      const created = data.member;

      const newMember = {
        id: created.id,
        fullName: created.full_name,
        email: created.email,
        memberNumber: created.member_number,
        joinedAt: created.joined_at,
        membershipStatus: created.membership_status,
        accountStatus: created.account_status,
        role: "member"
      };

      setMembers((previous) => [newMember, ...previous]);

      closeForm();

      alert(data.message || "Member successfully registered.");
    } catch (error) {
      console.error("Member registration failed:", error);
      setFormError(error.message || "Unable to register member.");
    } finally {
      setSaving(false);
    }
  };

 
const handleDeleteMember = async () => {
  if (!memberToDelete) return;

  const memberId = memberToDelete.id;

  try {
    const { data, error } = await supabase
      .from("profiles")
     .update({ account_status: "disabled" })
      .eq("id", memberId)
      .select("id, account_status")
      .single();

    if (error) throw error;

    if (!data) {
      throw new Error("Member could not be deactivated.");
    }

    // Update the member in the dashboard
    setMembers((previous) =>
      previous.map((member) =>
        member.id === memberId
          ? { ...member, accountStatus: "disabled" }
          : member
      )
    );

    if (selectedMember?.id === memberId) {
      setSelectedMember(null);
    }

    if (editingMemberId === memberId) {
      closeForm();
    }

    setMemberToDelete(null);

    alert("Member successfully deactivated.");
  } catch (error) {
    console.error("Member deactivation failed:", error);
    alert(error.message || "Unable to deactivate member.");
  }
};

  const activeMembers = members.filter(
    (member) => member.membershipStatus === "Active"
  ).length;

  const suspendedMembers = members.filter(
    (member) => member.membershipStatus === "Suspended"
  ).length;

  return (
    <div className="members-page">

      {/* Page heading */}
      <section className="members-heading">
        <div>
          <span className="eyebrow">MEMBER MANAGEMENT</span>
          <h1>Club Members</h1>
          <p>Manage membership profiles and account access.</p>
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

      {/* Summary cards */}
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
            <p>All registered club members</p>
          </div>

          <div className="member-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(event.target.value)
              }
            />
          </div>
        </div>

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

              {!loading && !loadError && filteredMembers.map((member) => (

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

                  <td>{member.joinedAt}</td>

                  <td>
                    <span
                      className={`member-status ${
                        member.membershipStatus.toLowerCase()
                      }`}
                    >
                      {member.membershipStatus}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`member-status ${
                        member.accountStatus.toLowerCase()
                      }`}
                    >
                      {member.accountStatus}
                    </span>
                  </td>

                  <td>
                    <div className="member-actions">
                      <button
                        title="View member"
                        aria-label="View member"
                        onClick={() => setSelectedMember(member)}
                      >
                        <Eye size={17} />
                      </button>

                      <button
                        title="Edit member"
                        aria-label="Edit member"
                        onClick={() => handleEditMember(member)}
                      >
                        <Pencil size={17} />
                      </button>

                      <button
                        className="delete-member-action"
                        title="Delete member"
                        aria-label={`Delete ${member.fullName}`}
                        onClick={() => setMemberToDelete(member)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>

                </tr>

              ))}

              {!loading && !loadError && filteredMembers.length === 0 && (
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

        <div
          className="member-modal-overlay"
          onClick={closeForm}
        >

          <div
            className="member-modal"
            onClick={(event) => event.stopPropagation()}
          >

            <div className="member-modal-header">
              <div>
                <h2>
                  {editingMemberId !== null ? "Edit Member" : "Add New Member"}
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

              <div className="member-default-info">
                <strong>Default account settings</strong>
                <span>Role: Member</span>
                <span>Membership: Active</span>
                <span>Account: Active</span>
                <small>
                  Members receive an email invitation to set up
                  their own login password.
              </small>
              </div>

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
                    ? "Creating account..."
                    : editingMemberId !== null
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
              <span>Joining date: {selectedMember.joinedAt}</span>
            </div>

            <div className="member-default-info">
              <strong>Account Information</strong>
              <span>Membership: {selectedMember.membershipStatus}</span>
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

      {/* Delete Member Confirmation */}
      {memberToDelete && (
        <div
          className="member-modal-overlay"
          onClick={() => setMemberToDelete(null)}
        >
          <div
            className="member-delete-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-member-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="delete-warning-icon">
              <AlertTriangle size={27} />
            </div>

            <h2 id="delete-member-title">Delete Member?</h2>

            <p>
              Are you sure you want to remove
              <strong> {memberToDelete.fullName} </strong>
              from the member directory?
            </p>

            <div className="delete-member-details">
              <span>Member number</span>
              <strong>{memberToDelete.memberNumber}</strong>

              <span>Email address</span>
              <strong>{memberToDelete.email}</strong>
            </div>

            <p className="delete-warning-text">
              This action will remove the member from this demo's
              directory. In the live application, financial history
              will be preserved.
            </p>

            <div className="member-form-actions">
              <button
                type="button"
                className="cancel-member-button"
                onClick={() => setMemberToDelete(null)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="confirm-delete-button"
                onClick={handleDeleteMember}
              >
                <Trash2 size={15} />
                Delete Member
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Members;