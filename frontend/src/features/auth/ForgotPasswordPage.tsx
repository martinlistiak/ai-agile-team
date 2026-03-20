import { useState, useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { RunaLogo } from "@/components/RunaLogo";
import api from "@/api/client";

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js";

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

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileHostRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";

  useLayoutEffect(() => {
    if (!turnstileSiteKey) {
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
  }, [turnstileSiteKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (turnstileSiteKey && !turnstileToken) {
      setError("Please complete the verification step below.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", {
        email,
        ...(turnstileToken ? { turnstileToken } : {}),
      });
      setDone(true);
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
          {done
            ? "If that email is linked to an account with a password, you will receive reset instructions shortly."
            : "Enter your email and we will send you a link to reset your password."}
        </p>
      </div>

      {!done ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label
              htmlFor="forgot-email"
              className="block text-[12px] font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
              required
              autoComplete="email"
            />
          </div>

          {error && (
            <p className="text-[13px] font-medium" style={{ color: "#dc2626" }}>
              {error}
            </p>
          )}

          {turnstileSiteKey ? (
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
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      ) : null}

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
