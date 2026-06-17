import { useState } from "react";
import { supabase } from "../lib/supabase";

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #F2EDE4; }
  .auth-app {
    min-height: 100vh;
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
    padding: 40px;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 4px 40px rgba(0,0,0,0.08);
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
  .auth-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 0;
  }
  .auth-divider-line { flex: 1; height: 1px; background: #E8E0D4; }
  .auth-divider-text { font-size: 12px; color: #B0A898; letter-spacing: 0.05em; }
`;

export default function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit() {
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

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
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
            {mode === "login" ? "Welcome back" : "Create account"}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#1C1C1C" }}>
            {mode === "login" ? "Sign in to your vault" : "Initialize your vault"}
          </div>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#B0A898", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Email</div>
          <input
            className="auth-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: "#B0A898", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Password</div>
          <input
            className="auth-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
          />
        </div>

        <button className="auth-btn" onClick={handleSubmit} disabled={!email || !password || loading}>
          {loading ? "Processing..." : mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <div className="auth-divider">
          <div className="auth-divider-line"></div>
          <div className="auth-divider-text">or</div>
          <div className="auth-divider-line"></div>
        </div>

        <button className="auth-btn-ghost" onClick={handleGoogle}>
          🔐 Continue with Google
        </button>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "#B0A898" }}>
          {mode === "login" ? "No account? " : "Already have one? "}
          <span
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); setSuccess(null); }}
            style={{ color: "#1C1C1C", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
          >
            {mode === "login" ? "Sign up free" : "Sign in"}
          </span>
        </div>
      </div>

      <div style={{ marginTop: 24, fontSize: 11, color: "#B0A898", letterSpacing: "0.08em" }}>
        DTE NEXUS · SECURED BY SUPABASE
      </div>
    </div>
  );
}
