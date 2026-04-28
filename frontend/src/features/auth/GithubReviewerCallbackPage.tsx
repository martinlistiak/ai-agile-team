import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/api/client";

const getProcessedCodeKey = (code: string) =>
  `github-reviewer-oauth-code:${code}`;

export function GithubReviewerCallbackPage() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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
      .post("/auth/github/reviewer/callback", { code })
      .then(() => {
        setSuccess(true);
        // If opened as a popup, notify the opener and close
        if (window.opener) {
          window.opener.postMessage(
            { type: "github-reviewer-connected" },
            window.location.origin,
          );
          window.close();
        }
      })
      .catch((err) => {
        sessionStorage.removeItem(processedCodeKey);
        setError(
          err.response?.data?.message ||
            "Failed to connect GitHub reviewer app",
        );
      });
  }, [searchParams]);

  if (success) {
    return (
      <div className="text-center">
        <div className="text-3xl mb-3" role="img" aria-label="checkmark">
          ✓
        </div>
        <p style={{ color: "var(--text-primary)" }}>
          GitHub reviewer app connected. You can close this window.
        </p>
      </div>
    );
  }

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
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-4" />
      <p className="text-gray-500">Connecting GitHub reviewer app...</p>
    </div>
  );
}
