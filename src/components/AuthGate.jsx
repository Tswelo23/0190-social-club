
import { useEffect, useState } from "react";
import {
  ShieldAlert,
  LogOut,
  LoaderCircle,
  LockKeyhole,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import Login from "./Login";
import MemberPortal from "./MemberPortal";
import "./AuthGate.css";

function PasswordUpdate() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleUpdatePassword = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess(
        "Your password has been updated successfully. Returning to sign in..."
      );

      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setError(
          "Your password was updated, but automatic sign-out failed. Please sign out and log in using your new password."
        );
      }
    } catch {
      setError("Unable to update your password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        <div className="login-brand">
          <div className="login-logo">0190</div>
          <h1>0190 Social Club</h1>
          <p>Financial Management Portal</p>
        </div>

        <div className="login-welcome">
          <div className="login-icon">
            <LockKeyhole size={27} />
          </div>

          <h2>Set a New Password</h2>
          <p>
            Create a new password for your 0190 Social Club account.
          </p>
        </div>

        <form onSubmit={handleUpdatePassword}>

          <div className="login-field">
            <label>New Password</label>

            <div className="login-input">
              <LockKeyhole size={18} />

              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter new password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </div>

          <div className="login-field">
            <label>Confirm New Password</label>

            <div className="login-input">
              <LockKeyhole size={18} />

              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                autoComplete="new-password"
                minLength={8}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowConfirmPassword(!showConfirmPassword)
                }
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="login-success" role="status">
              {success}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading || Boolean(success)}
          >
            {loading ? (
              <>
                <LoaderCircle size={18} className="login-spinner" />
                Updating Password...
              </>
            ) : (
              "Update Password"
            )}
          </button>

        </form>

        <div className="login-footer">
          <p>
            <ShieldCheck size={15} />
            Secure password recovery
          </p>
          <span>0190 Social Club © {new Date().getFullYear()}</span>
        </div>

      </div>
    </div>
  );
}

function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryMode(true);
      }

      if (event === "SIGNED_OUT") {
        setRecoveryMode(false);
      }

      setSession(nextSession);
      setProfile(null);
      setProfileError("");

      // Do not load a profile while the user is resetting a password.
      setProfileLoading(
        Boolean(nextSession) && event !== "PASSWORD_RECOVERY"
      );

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (recoveryMode) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    if (!session?.user?.id) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    let isActive = true;

    const loadProfile = async () => {
      setProfileLoading(true);
      setProfileError("");

      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          member_number,
          role,
          membership_status,
          account_status,
          joined_at
        `)
        .eq("id", session.user.id)
        .maybeSingle();

      if (!isActive) return;

      if (error) {
        setProfileError(error.message);
        setProfile(null);
      } else if (!data) {
        setProfileError(
          "No club profile was found for this account."
        );
        setProfile(null);
      } else if (data.account_status !== "active") {
        setProfileError(
          "Your 0190 Social Club account has been disabled. Please contact an administrator."
        );
        setProfile(null);
      } else if (!["admin", "member"].includes(data.role)) {
        setProfileError(
          "Your account does not have an authorised portal role."
        );
        setProfile(null);
      } else {
        setProfile({
          ...data,
          email: session.user.email,
        });
      }

      setProfileLoading(false);
    };

    loadProfile();

    return () => {
      isActive = false;
    };
  }, [session, recoveryMode]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setProfileError(error.message);
    }
  };

  if (recoveryMode) {
    return <PasswordUpdate />;
  }

  if (loading) {
    return (
      <div className="auth-loading">
        <LoaderCircle size={30} className="login-spinner" />
        <p>Checking your session...</p>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  if (profileLoading) {
    return (
      <div className="auth-loading">
        <LoaderCircle size={30} className="login-spinner" />
        <p>Loading your club account...</p>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="auth-message">
        <ShieldAlert size={38} />
        <h2>Account access unavailable</h2>
        <p>
          {profileError || "Your club profile could not be loaded."}
        </p>

        <button onClick={handleSignOut}>
          <LogOut size={17} />
          Sign out
        </button>
      </div>
    );
  }

  if (profile.role === "member") {
    return (
      <MemberPortal
        profile={profile}
        onSignOut={handleSignOut}
      />
    );
  }

  return children({
    profile,
    onSignOut: handleSignOut,
  });
}

export default AuthGate;
