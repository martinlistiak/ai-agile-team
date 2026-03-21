import { useState, useLayoutEffect, useRef, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { RunaLogo } from "@/components/RunaLogo";
import { useAuth } from "@/contexts/AuthContext";
import { FaGithub } from "react-icons/fa";
import { GitlabIcon } from "@/components/GitlabIcon";
import api from "@/api/client";
import { isSafeInternalPath, stashOAuthRedirect } from "@/lib/auth-redirect";

const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";

function loadTurnstileScript(): Promise<void> {
  if (typeof window !== "undefined" && window.turnstile) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TURNSTILE_SCRIPT}"]`,
    );
    if (existing) {
      if (window.turnstile) resolve();
      else {
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () =>
          reject(new Error("Turnstile load failed")),
        );
      }
      return;
    }
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile load failed"));
    document.body.appendChild(script);
  });
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileHostRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const wantsRegister =
      searchParams.get("register") === "1" ||
      searchParams.get("register") === "true" ||
      searchParams.get("mode") === "signup";
    if (wantsRegister) setIsRegister(true);
  }, [searchParams]);

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";

  useLayoutEffect(() => {
    if (!isRegister || !turnstileSiteKey) {
      setTurnstileToken(null);
      if (turnstileWidgetId.current && window.turnstile?.remove) {
        window.turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        await loadTurnstileScript();
      } catch {
        return;
      }
      if (cancelled || !turnstileHostRef.current || !window.turnstile) return;
      if (turnstileWidgetId.current && window.turnstile.remove) {
        window.turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
      turnstileWidgetId.current = window.turnstile.render(
        turnstileHostRef.current,
        {
          sitekey: turnstileSiteKey,
          callback: (token: string) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(null),
        },
      );
    };

    void run();

    return () => {
      cancelled = true;
      if (turnstileWidgetId.current && window.turnstile?.remove) {
        window.turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, [isRegister, turnstileSiteKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (isRegister && turnstileSiteKey && !turnstileToken) {
      setError("Please complete the verification step below.");
      return;
    }
    if (isRegister && (!acceptTerms || !acceptPrivacy)) {
      setError(
        "You must accept the Terms of Service and Privacy Policy to create an account.",
      );
      return;
    }
    setLoading(true);
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const payload = isRegister
        ? {
            email,
            password,
            name,
            acceptTerms,
            acceptPrivacy,
            ...(turnstileToken ? { turnstileToken } : {}),
          }
        : { email, password };
      const { data } = await api.post(endpoint, payload);
      login(data.accessToken, data.user);
      const next = searchParams.get("next");
      navigate(isSafeInternalPath(next) ? next : "/");
    } catch (err: any) {
      setError(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGithubLogin = () => {
    stashOAuthRedirect(searchParams.get("next"));
    window.location.href = "/api/auth/github";
  };

  const handleGitlabLogin = () => {
    stashOAuthRedirect(searchParams.get("next"));
    window.location.href = "/api/auth/gitlab";
  };

  return (
    <div>
      {/* Logo + heading */}
      <div className="mb-10">
        <Link to="/" className="no-underline block mb-3 leading-none">
          <RunaLogo height={42} />
        </Link>
        <p
          className="text-[15px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {isRegister
            ? searchParams.get("next") === "/billing"
              ? "Create your account, then start your trial on the next step."
              : "Create your account to get started."
            : searchParams.get("next") === "/billing"
              ? "Sign in to continue to billing and start your trial."
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
          className="cursor-pointer flex-1 flex items-center justify-center gap-0.5 rounded-lg px-4 py-3 text-[13px] font-medium transition-all"
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
          <GitlabIcon size={32} className="shrink-0" />
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
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label
              htmlFor="auth-password"
              className="block text-[12px] font-medium"
              style={{ color: "var(--text-secondary)" }}
            >
              Password
            </label>
            {!isRegister ? (
              <Link
                to="/login/forgot-password"
                className="text-[12px] font-medium shrink-0 transition-opacity hover:opacity-70"
                style={{ color: "var(--accent)" }}
              >
                Forgot password?
              </Link>
            ) : null}
          </div>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            required
          />
        </div>

        {isRegister && (
          <div className="space-y-2.5 pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 accent-(--accent)"
              />
              <span
                className="text-[12.5px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                I agree to the{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline transition-opacity hover:opacity-70"
                  style={{ color: "var(--accent)" }}
                >
                  Terms of Service
                </a>
              </span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptPrivacy}
                onChange={(e) => setAcceptPrivacy(e.target.checked)}
                className="mt-0.5 accent-(--accent)"
              />
              <span
                className="text-[12.5px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}
              >
                I have read and accept the{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline transition-opacity hover:opacity-70"
                  style={{ color: "var(--accent)" }}
                >
                  Privacy Policy
                </a>
              </span>
            </label>
          </div>
        )}

        {error && (
          <p className="text-[13px] font-medium" style={{ color: "#dc2626" }}>
            {error}
          </p>
        )}

        {isRegister && turnstileSiteKey ? (
          <div ref={turnstileHostRef} className="min-h-[65px]" />
        ) : null}

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
            setTurnstileToken(null);
            setAcceptTerms(false);
            setAcceptPrivacy(false);
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
