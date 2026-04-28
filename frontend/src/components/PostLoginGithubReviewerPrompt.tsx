import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { GithubReviewerConnectDialog } from "@/components/GithubReviewerConnectDialog";
import { GITHUB_REVIEWER_LOGIN_PROMPT_KEY } from "@/lib/github-reviewer-login-prompt";

/**
 * One-time prompt after GitHub login to connect the reviewer OAuth app before using the board.
 */
export function PostLoginGithubReviewerPrompt() {
  const { user, refreshUser } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem(GITHUB_REVIEWER_LOGIN_PROMPT_KEY) !== "1") {
      return;
    }
    if (user.hasGithubReviewer) {
      sessionStorage.removeItem(GITHUB_REVIEWER_LOGIN_PROMPT_KEY);
      return;
    }
    if (!user.hasGithub) {
      sessionStorage.removeItem(GITHUB_REVIEWER_LOGIN_PROMPT_KEY);
      return;
    }
    setOpen(true);
  }, [user]);

  return (
    <GithubReviewerConnectDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) sessionStorage.removeItem(GITHUB_REVIEWER_LOGIN_PROMPT_KEY);
      }}
      onConnected={() => {
        sessionStorage.removeItem(GITHUB_REVIEWER_LOGIN_PROMPT_KEY);
        void refreshUser();
      }}
    />
  );
}
