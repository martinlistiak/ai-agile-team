import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { RunaLogo } from "@/components/RunaLogo";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/api/client";
import { isSafeInternalPath } from "@/lib/auth-redirect";

export function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  const token = searchParams.get("token")?.trim() ?? "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("This link is missing a reset token. Request a new reset email.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/reset-password", {
        token,
        password,
      });
      login(data.accessToken, data.user);
      const next = searchParams.get("next");
      navigate(isSafeInternalPath(next) ? next : "/");
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      setError(ax.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-10">
        <Link to="/home" className="no-underline block mb-3 leading-none">
          <RunaLogo height={42} />
        </Link>
        <p
          className="text-[15px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Choose a new password for your account.
        </p>
      </div>

      {!token ? (
        <p className="text-[13px] font-medium" style={{ color: "#dc2626" }}>
          This link is invalid or incomplete.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="reset-password"
              className="block text-[12px] font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              New password
            </label>
            <input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-input"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label
              htmlFor="reset-password-confirm"
              className="block text-[12px] font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Confirm password
            </label>
            <input
              id="reset-password-confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="auth-input"
              required
              minLength={8}
              autoComplete="new-password"
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
            {loading ? "Saving…" : "Update password"}
          </button>
        </form>
      )}

      <p
        className="text-[13px] mt-6 text-center"
        style={{ color: "var(--text-tertiary)" }}
      >
        <Link
          to="/login"
          className="font-medium transition-opacity hover:opacity-70"
          style={{ color: "var(--accent)" }}
        >
          Back to sign in
        </Link>
        {" · "}
        <Link
          to="/login/forgot-password"
          className="font-medium transition-opacity hover:opacity-70"
          style={{ color: "var(--accent)" }}
        >
          Request another link
        </Link>
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
