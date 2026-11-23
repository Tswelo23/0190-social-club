
import { useState } from "react";
import {
  ShieldCheck,
  LockKeyhole,
  Mail,
  Eye,
  EyeOff,
  LoaderCircle,
  ArrowLeft,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [forgotPassword, setForgotPassword] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(error.message);
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: redirectUrl,
        }
      );

      if (error) {
        setError(error.message);
      } else {
        setMessage(
          "Password recovery email sent. Please check your inbox and follow the link to create a new password."
        );
      }
    } catch {
      setError("Unable to send the recovery email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const returnToLogin = () => {
    setForgotPassword(false);
    setError("");
    setMessage("");
    setPassword("");
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
            {forgotPassword ? (
              <LockKeyhole size={27} />
            ) : (
              <ShieldCheck size={27} />
            )}
          </div>

          <h2>
            {forgotPassword ? "Reset your password" : "Welcome back"}
          </h2>

          <p>
            {forgotPassword
              ? "Enter your registered email address to receive a password recovery link."
              : "Sign in to access your club account."}
          </p>
        </div>

        {forgotPassword ? (
          <form onSubmit={handlePasswordReset}>
            <div className="login-field">
              <label>Email Address</label>

              <div className="login-input">
                <Mail size={18} />

                <input
                  type="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            {message && (
              <div className="login-success" role="status">
                {message}
              </div>
            )}

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle size={18} className="login-spinner" />
                  Sending recovery email...
                </>
              ) : (
                "Send Recovery Link"
              )}
            </button>

            <button
              type="button"
              className="forgot-password-link"
              onClick={returnToLogin}
            >
              <ArrowLeft size={16} />
              Back to Sign In
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <div className="login-field">
              <label>Email Address</label>

              <div className="login-input">
                <Mail size={18} />

                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label>Password</label>

              <div className="login-input">
                <LockKeyhole size={18} />

                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            <div className="forgot-password-container">
              <button
                type="button"
                className="forgot-password-link"
                onClick={() => {
                  setForgotPassword(true);
                  setError("");
                  setMessage("");
                }}
              >
                Forgot Password?
              </button>
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <LoaderCircle size={18} className="login-spinner" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        )}

        <div className="login-footer">
          <p>
            <ShieldCheck size={15} />
            Secure access for registered club members
          </p>

          <span>0190 Social Club © {new Date().getFullYear()}</span>
        </div>

      </div>
    </div>
  );
}

export default Login;
