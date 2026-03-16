import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { FaGithub, FaGitlab } from "react-icons/fa";
import api from "@/api/client";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const payload = isRegister
        ? { email, password, name }
        : { email, password };
      const { data } = await api.post(endpoint, payload);
      login(data.accessToken, data.user);
      navigate("/");
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = () => {
    window.location.href = "/api/auth/github";
  };

  const handleGitlabLogin = () => {
    window.location.href = "/api/auth/gitlab";
  };

  return (
    <div>
      {/* Logo + heading */}
      <div className="mb-10">
        <Link
          to="/home"
          className="font-display text-[2.6rem] leading-none tracking-tight no-underline block mb-3"
          style={{ color: "var(--text-primary)" }}
        >
          Runa
        </Link>
        <p
          className="text-[15px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {isRegister
            ? "Create your account to get started."
            : "Sign in to your workspace."}
        </p>
      </div>

      {/* OAuth buttons */}
      <div className="flex gap-3 mb-8">
        <button
          type="button"
          onClick={handleGithubLogin}
          className="cursor-pointer flex-1 flex items-center justify-center gap-2.5 rounded-lg px-4 py-3 text-[13px] font-medium transition-all"
          style={{
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            background: "var(--surface-raised)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--text-tertiary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          <FaGithub size={18} />
          GitHub
        </button>
        <button
          type="button"
          onClick={handleGitlabLogin}
          className="cursor-pointer flex-1 flex items-center justify-center gap-2.5 rounded-lg px-4 py-3 text-[13px] font-medium transition-all"
          style={{
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            background: "var(--surface-raised)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--text-tertiary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          <FaGitlab size={18} style={{ color: "#fc6d26" }} />
          GitLab
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        <span
          className="text-[11px] font-medium tracking-wide uppercase"
          style={{ color: "var(--text-tertiary)" }}
        >
          or continue with email
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {isRegister && (
          <div>
            <label
              htmlFor="auth-name"
              className="block text-[12px] font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Name
            </label>
            <input
              id="auth-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="auth-input"
              required
            />
          </div>
        )}
        <div>
          <label
            htmlFor="auth-email"
            className="block text-[12px] font-medium mb-1.5"
            style={{ color: "var(--text-secondary)" }}
          >
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            required
          />
        </div>
        <div>
          <label
            htmlFor="auth-password"
            className="block text-[12px] font-medium mb-1.5"
            style={{ color: "var(--text-secondary)" }}
          >
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            required
          />
        </div>

        {error && (
          <p className="text-[13px] font-medium" style={{ color: "#dc2626" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="cursor-pointer w-full text-[13px] font-medium py-3 rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "var(--accent)",
            marginTop: "1.25rem",
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.opacity = "0.88";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          {loading ? "One moment…" : isRegister ? "Create account" : "Sign in"}
        </button>
      </form>

      {/* Toggle */}
      <p
        className="text-[13px] mt-6 text-center"
        style={{ color: "var(--text-tertiary)" }}
      >
        {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setIsRegister(!isRegister);
            setError("");
          }}
          className="cursor-pointer font-medium transition-opacity hover:opacity-70"
          style={{ color: "var(--accent)" }}
        >
          {isRegister ? "Sign in" : "Create one"}
        </button>
      </p>

      <style>{`
        .auth-input {
          width: 100%;
          padding: 0.7rem 0.875rem;
          border-radius: 0.5rem;
          border: 1px solid var(--border);
          background: var(--surface-raised);
          color: var(--text-primary);
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .auth-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-soft);
        }
        .auth-input::placeholder {
          color: var(--text-tertiary);
        }
      `}</style>
    </div>
  );
}
