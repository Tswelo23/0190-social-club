import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LockKeyhole,
  ShieldCheck,
  MailWarning,
  LoaderCircle,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import "./AcceptInvitation.css";

const MIN_LENGTH = 8;

const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];

const EXPIRED_MESSAGE =
  "Your invitation link is invalid or has expired. Please ask the club administrator to send you a new invitation.";

function getChecks(password) {
  return [
    { id: "length", label: `At least ${MIN_LENGTH} characters`, ok: password.length >= MIN_LENGTH },
    { id: "case", label: "Upper and lower case letters", ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { id: "number", label: "A number", ok: /\d/.test(password) },
    { id: "symbol", label: "A symbol, such as ! @ #", ok: /[^A-Za-z0-9]/.test(password) },
  ];
}

function AcceptInvitation() {
  // "checking" -> "ready" | "invalid" -> "success"
  const [status, setStatus] = useState("checking");
  const [linkError, setLinkError] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  /* ---------- confirm the invitation link produced a session ---------- */

  useEffect(() => {
    let active = true;

    // Supabase reports expired or reused links in the URL hash
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const hashError = hash.get("error_description");

    if (hashError) {
      setLinkError(EXPIRED_MESSAGE);
      setStatus("invalid");
      return undefined;
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) setStatus("ready");
    });

    const verify = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (session) {
        setStatus("ready");
      } else {
        // Give the token in the URL a moment to be processed before giving up
        setTimeout(async () => {
          const {
            data: { session: later },
          } = await supabase.auth.getSession();

          if (!active) return;
          if (later) {
            setStatus("ready");
          } else {
            setLinkError(EXPIRED_MESSAGE);
            setStatus("invalid");
          }
        }, 1500);
      }
    };

    verify();

    return () => {
      active = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  /* ---------- password feedback ---------- */

  const checks = getChecks(password);
  const longEnough = checks[0].ok;
  const score = checks.filter((check) => check.ok).length;
  const bars = !password ? 0 : longEnough ? score : 1;
  const strengthLabel = !password ? "" : longEnough ? STRENGTH_LABELS[score] : "Too short";
  const strengthTone = ["", "weak", "fair", "good", "strong"][bars];

  const confirmTyped = confirmPassword.length > 0;
  const matches = confirmTyped && password === confirmPassword;

  const trackCapsLock = (event) => setCapsLock(event.getModifierState?.("CapsLock") ?? false);

  /* ---------- submit ---------- */

  const handlePasswordSetup = async (event) => {
    event.preventDefault();
    setError("");

    if (!longEnough) {
      setError(`Your password must contain at least ${MIN_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error(EXPIRED_MESSAGE);

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setStatus("success");

      // Members sign in fresh with their new password
      await supabase.auth.signOut();
    } catch (err) {
      setError(err.message || "Unable to set your password.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- render ---------- */

  return (
    <div className="inv">
      <main className="inv-card" aria-live="polite">
        <div className="inv-logo">0190</div>

        {status === "checking" && (
          <div className="inv-state">
            <LoaderCircle size={36} className="inv-spin" />
            <h1>Checking your invitation</h1>
            <p>One moment while we confirm your invitation link.</p>
          </div>
        )}

        {status === "invalid" && (
          <div className="inv-state">
            <div className="inv-icon danger">
              <MailWarning size={30} />
            </div>
            <h1>Invitation link unavailable</h1>
            <p>{linkError || EXPIRED_MESSAGE}</p>

            <button className="inv-button" onClick={() => navigate("/", { replace: true })}>
              Go to Login
            </button>
          </div>
        )}

        {status === "success" && (
          <div className="inv-state">
            <div className="inv-icon success">
              <ShieldCheck size={32} />
            </div>
            <h1>Password created!</h1>
            <p>
              Your 0190 Social Club account is ready. You can now sign in using your email and
              password.
            </p>

            <button className="inv-button" onClick={() => navigate("/", { replace: true })}>
              Continue to Login
            </button>
          </div>
        )}

        {status === "ready" && (
          <>
            <div className="inv-icon">
              <LockKeyhole size={30} />
            </div>

            <h1>Set Your Password</h1>
            <p>Welcome to 0190 Social Club. Create a password to access your member account.</p>

            <form onSubmit={handlePasswordSetup} noValidate>
              <label htmlFor="inv-password">New Password</label>

              <div className="inv-field">
                <input
                  id="inv-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyUp={trackCapsLock}
                  onKeyDown={trackCapsLock}
                  placeholder="Enter your password"
                  autoComplete="new-password"
                  autoFocus
                  required
                />

                <button
                  type="button"
                  className="inv-eye"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {capsLock && <p className="inv-hint warn">Caps Lock is on.</p>}

              {password && (
                <div className="inv-strength">
                  <div className={`inv-meter ${strengthTone}`} aria-hidden="true">
                    {[1, 2, 3, 4].map((segment) => (
                      <i key={segment} className={segment <= bars ? "on" : ""} />
                    ))}
                  </div>
                  <span className={strengthTone}>{strengthLabel}</span>
                </div>
              )}

              <ul className="inv-checks">
                {checks.map((check) => (
                  <li key={check.id} className={check.ok ? "ok" : ""}>
                    <span aria-hidden="true">{check.ok && <Check size={11} strokeWidth={3} />}</span>
                    {check.label}
                    {check.id !== "length" && !check.ok && <small>recommended</small>}
                  </li>
                ))}
              </ul>

              <label htmlFor="inv-confirm">Confirm Password</label>

              <div className="inv-field">
                <input
                  id="inv-confirm"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  onKeyUp={trackCapsLock}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  aria-invalid={confirmTyped && !matches}
                  required
                />
              </div>

              {confirmTyped && (
                <p className={`inv-hint ${matches ? "good" : "warn"}`}>
                  {matches ? "Passwords match." : "Passwords do not match yet."}
                </p>
              )}

              {error && (
                <div className="inv-error" role="alert">
                  {error}
                </div>
              )}

              <button type="submit" className="inv-button" disabled={loading}>
                {loading ? "Setting password..." : "Create Password"}
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

export default AcceptInvitation;