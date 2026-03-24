import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { AxiosError } from "axios";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/api/client";
import { consumeAuthRedirect } from "@/lib/auth-redirect";

const getProcessedCodeKey = (code: string) => `gitlab-oauth-code:${code}`;

export function GitlabCallbackPage() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("No authorization code received");
      return;
    }

    const processedCodeKey = getProcessedCodeKey(code);
    if (sessionStorage.getItem(processedCodeKey)) {
      return;
    }

    sessionStorage.setItem(processedCodeKey, "processing");

    api
      .post("/auth/gitlab/callback", { code })
      .then(({ data }) => {
        login(data.accessToken, data.user);
        const stashed = consumeAuthRedirect();
        const hasSubscription =
          data.user.subscriptionStatus === "active" ||
          data.user.subscriptionStatus === "trialing" ||
          data.user.hasTeamMembership;
        const dest = stashed ?? (hasSubscription ? "/spaces" : "/billing");
        navigate(dest, { replace: true });
      })
      .catch((err: AxiosError<{ message?: string }>) => {
        sessionStorage.removeItem(processedCodeKey);
        setError(
          err.response?.data?.message || "Failed to authenticate with GitLab",
        );
      });
  }, [searchParams, login, navigate]);

  if (error) {
    return (
      <div className="text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <a
          href="/login"
          className="cursor-pointer text-primary-500 hover:underline"
        >
          Back to login
        </a>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="text-gray-500">Authenticating with GitLab…</p>
    </div>
  );
}
