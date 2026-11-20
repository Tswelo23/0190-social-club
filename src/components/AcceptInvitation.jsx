
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyhole, ShieldCheck } from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import "./AcceptInvitation.css";

function AcceptInvitation() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const navigate = useNavigate();

  const handlePasswordSetup = async (event) => {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error(
          "Your invitation session is missing or expired. Please request a new invitation."
        );
      }

      const { error } = await supabase.auth.updateUser({
        password
      });

      if (error) throw error;

      setSuccess(true);

      await supabase.auth.signOut();

    } catch (err) {
      setError(err.message || "Unable to set your password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="invitation-page">
      <div className="invitation-card">

        <div className="invitation-logo">0190</div>

        {success ? (
          <>
            <ShieldCheck size={45} color="#269968" />

            <h1>Password created!</h1>

            <p>
              Your 0190 Social Club account is ready.
              You can now sign in using your email and password.
            </p>

            <button onClick={() => navigate("/", { replace: true })}>
              Continue to Login
            </button>
          </>
        ) : (
          <>
            <LockKeyhole size={35} color="#3977d1" />

            <h1>Set Your Password</h1>

            <p>
              Welcome to 0190 Social Club.
              Create a password to access your member account.
            </p>

            <form onSubmit={handlePasswordSetup}>

              <label>New Password</label>

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="new-password"
                minLength={8}
                required
              />

              <label>Confirm Password</label>

              <input
                type="password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                placeholder="Confirm your password"
                autoComplete="new-password"
                required
              />

              {error && (
                <div className="invitation-error">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}>
                {loading ? "Setting password..." : "Create Password"}
              </button>

            </form>
          </>
        )}

      </div>
    </div>
  );
}

export default AcceptInvitation;
