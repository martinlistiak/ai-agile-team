import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/api/client";

export function EmailVerificationBanner() {
  const { user, token, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!user || user.emailVerified !== false) {
    return null;
  }

  const handleResend = async () => {
    if (!token || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const { data } = await api.post("/auth/resend-verification", {});
      setNotice(data?.message ?? "Check your inbox.");
      await refreshUser();
    } catch {
      setNotice("Could not send email. Try again in a few minutes.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="shrink-0 px-4 py-2.5 text-[13px] flex flex-wrap items-center gap-x-4 gap-y-2 border-b"
      style={{
        background: "var(--accent-soft, rgba(99, 102, 241, 0.12))",
        borderColor: "var(--border)",
        color: "var(--text-primary)",
      }}
    >
      <span style={{ color: "var(--text-secondary)" }}>
        Confirm your email to unlock team invitations and help us reach your inbox reliably.
      </span>
      <button
        type="button"
        disabled={busy || !token}
        onClick={() => void handleResend()}
        className="font-medium underline-offset-2 hover:underline disabled:opacity-50 cursor-pointer bg-transparent border-0 p-0 shrink-0"
        style={{ color: "var(--accent)" }}
      >
        {busy ? "Sending…" : "Resend email"}
      </button>
      {notice ? (
        <span className="w-full text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          {notice}
        </span>
      ) : null}
    </div>
  );
}
