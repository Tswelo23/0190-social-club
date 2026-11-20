import { useEffect, useState } from "react";
import { ShieldAlert, LogOut, LoaderCircle } from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import Login from "./Login";
import "./AuthGate.css";

function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Listen for authentication changes
  useEffect(() => {
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setProfile(null);
      setProfileError("");
      setProfileLoading(Boolean(nextSession));
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Retrieve the logged-in user's profile
  useEffect(() => {
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
          "No active club profile was found for this account."
        );
        setProfile(null);
      } else if (data.account_status !== "active") {
        setProfileError(
          "Your 0190 Social Club account has been disabled. Please contact an administrator."
        );
        setProfile(null);
      } else {
        setProfile({
          ...data,
          email: session.user.email
        });
      }

      setProfileLoading(false);
    };

    loadProfile();

    return () => {
      isActive = false;
    };
  }, [session]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setProfileError(error.message);
    }
  };

  if (loading) {
    return (
      <div className="auth-loading">
        <LoaderCircle size={30} className="login-spinner" />
        <p>Checking your session...</p>
      </div>
    );
  }

  // No authenticated session: display login
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

  // Reject missing, inaccessible or disabled profiles
  if (profileError || !profile) {
    const message =
      profileError || "Your club profile could not be loaded.";

    return (
      <div className="auth-message">
        <ShieldAlert size={38} />

        <h2>Account access unavailable</h2>

        <p>{message}</p>

        <button onClick={handleSignOut}>
          <LogOut size={17} />
          Sign out
        </button>
      </div>
    );
  }

  // Members receive a separate, read-only landing page
  if (profile.role !== "admin") {
    return (
      <div className="member-welcome-page">
        <div className="member-welcome-card">

          <div className="member-welcome-logo">0190</div>

          <span className="member-welcome-label">
            MEMBER PORTAL
          </span>

          <h1>Welcome, {profile.full_name}</h1>

          <p>
            Your 0190 Social Club account is connected.
            Your personal financial dashboard will be
            available here.
          </p>

          <div className="member-account-info">
            <div>
              <span>Member number</span>
              <strong>{profile.member_number || "Not assigned"}</strong>
            </div>

            <div>
              <span>Membership status</span>
              <strong>{profile.membership_status}</strong>
            </div>

            <div>
              <span>Account status</span>
              <strong>{profile.account_status}</strong>
            </div>
          </div>

          <button onClick={handleSignOut}>
            <LogOut size={17} />
            Sign out
          </button>

        </div>
      </div>
    );
  }

  // Only administrators can access the administration dashboard
  return children({
    profile,
    onSignOut: handleSignOut
  });
}

export default AuthGate;