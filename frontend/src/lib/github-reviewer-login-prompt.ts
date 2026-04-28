export const GITHUB_REVIEWER_LOGIN_PROMPT_KEY =
  "runa_prompt_github_reviewer_after_login";

/** Call after GitHub sign-in when the reviewer app is not yet connected. */
export function stashGithubReviewerLoginPrompt(): void {
  sessionStorage.setItem(GITHUB_REVIEWER_LOGIN_PROMPT_KEY, "1");
}
