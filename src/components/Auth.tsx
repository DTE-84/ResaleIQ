import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Eye, EyeOff } from "lucide-react";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #F2EDE4; }
  .auth-app {
    min-height: 100vh;
    min-height: 100dvh;
    background: #F2EDE4;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Space Grotesk', sans-serif;
    padding: 24px;
  }
  .auth-card {
    background: #fff;
    border-radius: 20px;
    padding: clamp(24px, 6vw, 40px);
    width: 100%;
    max-width: 420px;
    box-shadow: 0 4px 40px rgba(0,0,0,0.08);
  }
  .auth-input-container {
    position: relative;
    width: 100%;
  }
  .auth-input {
    width: 100%;
    background: #F8F5F0;
    border: 1px solid #E8E0D4;
    border-radius: 10px;
    padding: 12px 14px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 14px;
    color: #1C1C1C;
    outline: none;
    transition: border-color 0.2s;
  }
  .auth-input:focus { border-color: #D4A843; }
  .auth-input::placeholder { color: #B0A898; }
  .auth-password-toggle {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #B0A898;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    transition: color 0.2s;
  }
  .auth-password-toggle:hover { color: #1C1C1C; }
  .auth-btn {
    width: 100%;
    background: #1C1C1C;
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 13px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.2s;
    margin-top: 8px;
  }
  .auth-btn:hover { background: #333; }
  .auth-btn:disabled { background: #B0A898; cursor: not-allowed; }
  .auth-btn-ghost {
    width: 100%;
    background: transparent;
    color: #1C1C1C;
    border: 1px solid #E8E0D4;
    border-radius: 10px;
    padding: 13px;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 10px;
    transition: border-color 0.2s;
  }
  .auth-btn-ghost:hover { border-color: #1C1C1C; }
  .auth-error {
    background: rgba(220, 80, 80, 0.08);
    border: 1px solid rgba(220, 80, 80, 0.2);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    color: #C04040;
    margin-bottom: 16px;
  }
  .auth-success {
    background: rgba(60, 180, 120, 0.08);
    border: 1px solid rgba(60, 180, 120, 0.2);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    color: #2A8A5A;
    margin-bottom: 16px;
  }
  .auth-link {
    background: none;
    border: none;
    padding: 0;
    font: inherit;
    font-size: 12px;
    color: #8A8070;
    cursor: pointer;
    text-decoration: underline;
  }
  .auth-link-strong { font-size: 13px; color: #1C1C1C; font-weight: 600; }
  .auth-app a { color: inherit; }
  .auth-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 0;
  }
  .auth-divider-line { flex: 1; height: 1px; background: #E8E0D4; }
  .auth-divider-text { font-size: 12px; color: #B0A898; letter-spacing: 0.05em; }
`;

type Props = {
  /** Set when the user arrived from a password-reset email link. */
  recovery?: boolean;
  onRecovered?: () => void;
};

export default function Auth({ recovery = false, onRecovered }: Props) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit() {
    if (recovery) {
      if (password.length < 8) return setError("Use at least 8 characters.");
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.updateUser({ password });
      setLoading(false);
      if (error) setError(error.message);
      else onRecovered?.();
      return;
    }
    if (mode === "forgot") {
      if (!email) return;
      setLoading(true);
      setError(null);
      setSuccess(null);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: import.meta.env.VITE_SITE_URL || window.location.origin,
      });
      setLoading(false);
      // Same message either way so the form can't be used to probe for accounts.
      if (error && error.status !== 400) setError(error.message);
      else setSuccess("If an account exists for that email, a reset link is on its way.");
      return;
    }
    if (!email || !password) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setSuccess("Check your email to confirm your account, then log in.");
    }
    setLoading(false);
  }

  function switchMode(next: typeof mode) {
    setMode(next);
    setError(null);
    setSuccess(null);
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: import.meta.env.VITE_SITE_URL || window.location.origin },
    });
  }

  return (
    <div className="auth-app">
      <style>{css}</style>

      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, background: "#1C1C1C", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚡</div>
          <span style={{ fontSize: 24, fontWeight: 700, color: "#1C1C1C", letterSpacing: "-0.3px" }}>
            RESALE<span style={{ color: "#D4A843" }}>IQ</span>
          </span>
        </div>
        <div style={{ fontSize: 11, color: "#B0A898", letterSpacing: "0.15em", textTransform: "uppercase" }}>
          Strategic Intelligence Nexus
        </div>
      </div>

      <div className="auth-card">
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#B0A898", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
            {recovery ? "Account recovery" : mode === "login" ? "Welcome back" : mode === "signup" ? "Create account" : "Forgot password"}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1C1C1C" }}>
            {recovery ? "Choose a new password" : mode === "login" ? "Sign in to your vault" : mode === "signup" ? "Initialize your vault" : "Reset your password"}
          </div>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        {!recovery && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: "#B0A898", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Email</div>
            <input
              className="auth-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
            />
          </div>
        )}

        {mode !== "forgot" && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: "#B0A898", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {recovery ? "New password" : "Password"}
              </div>
              {mode === "login" && !recovery && (
                <button type="button" className="auth-link" onClick={() => switchMode("forgot")}>
                  Forgot password?
                </button>
              )}
            </div>
            <div className="auth-input-container">
              <input
                className="auth-input"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" && !recovery ? "current-password" : "new-password"}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
              />
              <button
                type="button"
                className="auth-password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        )}

        <button
          className="auth-btn"
          onClick={handleSubmit}
          disabled={loading || (recovery ? !password : mode === "forgot" ? !email : !email || !password)}
        >
          {loading
            ? "Processing..."
            : recovery ? "Save Password"
            : mode === "login" ? "Sign In"
            : mode === "signup" ? "Create Account"
            : "Send Reset Link"}
        </button>

        {mode !== "forgot" && !recovery && (
          <>
            <div className="auth-divider">
              <div className="auth-divider-line"></div>
              <div className="auth-divider-text">or</div>
              <div className="auth-divider-line"></div>
            </div>

            <button className="auth-btn-ghost" onClick={handleGoogle}>
              🔐 Continue with Google
            </button>
          </>
        )}

        {!recovery && (
          <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#B0A898" }}>
            {mode === "login" ? "No account? " : mode === "signup" ? "Already have one? " : "Remembered it? "}
            <button type="button" className="auth-link auth-link-strong" onClick={() => switchMode(mode === "login" ? "signup" : "login")}>
              {mode === "login" ? "Sign up free" : "Sign in"}
            </button>
          </div>
        )}

        {mode === "signup" && !recovery && (
          <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "#B0A898", lineHeight: 1.5 }}>
            By creating an account you agree to the <a href="/terms.html">Terms</a> and{" "}
            <a href="/privacy.html">Privacy Policy</a>.
          </div>
        )}
      </div>

      <div style={{ marginTop: 24, fontSize: 11, color: "#B0A898", letterSpacing: "0.08em", display: "flex", gap: 14 }}>
        <a href="/privacy.html">PRIVACY</a>
        <span>·</span>
        <a href="/terms.html">TERMS</a>
        <span>·</span>
        <span>SECURED BY SUPABASE</span>
      </div>
    </div>
  );
}
