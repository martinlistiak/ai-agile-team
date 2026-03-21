import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { RunaLogo } from "@/components/RunaLogo";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/api/client";
import { isSafeInternalPath } from "@/lib/auth-redirect";

export function VerifyEmailPage() {
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const ranRef = useRef(false);

  const token = searchParams.get("token")?.trim() ?? "";

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This link is missing a verification token.");
      return;
    }
    if (ranRef.current) return;
    ranRef.current = true;

    void (async () => {
      try {
        const { data } = await api.post("/auth/verify-email", { token });
        login(data.accessToken, data.user);
        setStatus("ok");
        setMessage("Your email is verified.");
        const next = searchParams.get("next");
        const target = isSafeInternalPath(next) ? next : "/spaces";
        setTimeout(() => navigate(target, { replace: true }), 800);
      } catch (err: unknown) {
        setStatus("error");
        const ax = err as { response?: { data?: { message?: string } } };
        setMessage(
          ax.response?.data?.message ||
            "This link is invalid or has expired. Sign in and resend verification from the banner.",
        );
      }
    })();
  }, [token, login, navigate, searchParams]);

  return (
    <div>
      <div className="mb-10">
        <Link to="/" className="no-underline block mb-3 leading-none">
          <RunaLogo height={42} />
        </Link>
        <p
          className="text-[15px] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {status === "working"
            ? "Verifying your email…"
            : status === "ok"
              ? "You're all set."
              : "We could not verify your email"}
        </p>
      </div>

      {status === "working" ? (
        <p className="text-[13px]" style={{ color: "var(--text-tertiary)" }}>
          One moment.
        </p>
      ) : (
        <p
          className="text-[13px] font-medium"
          style={{
            color: status === "ok" ? "var(--text-secondary)" : "#dc2626",
          }}
        >
          {message}
        </p>
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
      </p>
    </div>
  );
}
