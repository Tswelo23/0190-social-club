
import { useState } from "react";
import {
  ShieldCheck,
  LockKeyhole,
  Mail,
  Eye,
  EyeOff,
  LoaderCircle
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import "./Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
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
            <ShieldCheck size={27} />
          </div>

          <h2>Welcome back</h2>
          <p>Sign in to access your club account.</p>
        </div>

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
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
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

        <div className="login-footer">
          <p>
            <ShieldCheck size={15} />
            Secure access for registered club members
          </p>
          <span>0190 Social Club © 2026</span>
        </div>

      </div>

    </div>
  );
}

export default Login;
