import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { AxiosError } from "axios";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/api/client";
import {
  consumeAuthRedirect,
  getLoginPath,
  peekAuthRedirect,
} from "@/lib/auth-redirect";
import { stashGithubReviewerLoginPrompt } from "@/lib/github-reviewer-login-prompt";

const getProcessedCodeKey = (code: string) => `github-oauth-code:${code}`;

export function GithubCallbackPage() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const loginHref = getLoginPath(peekAuthRedirect());

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
      .post("/auth/github/callback", { code })
      .then(({ data }) => {
        login(data.accessToken, data.user);
        if (data.user.hasGithub && !data.user.hasGithubReviewer) {
          stashGithubReviewerLoginPrompt();
        }
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
          err.response?.data?.message || "Failed to authenticate with GitHub",
        );
      });
  }, [searchParams, login, navigate]);

  if (error) {
    return (
      <div className="text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <a
          href={loginHref}
          className="cursor-pointer text-primary-500 hover:underline"
        >
          Back to login
        </a>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4" />
      <p className="text-gray-500">Authenticating with GitHub...</p>
    </div>
  );
}
