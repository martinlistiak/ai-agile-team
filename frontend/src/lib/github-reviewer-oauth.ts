import api from "@/api/client";

/** Opens GitHub reviewer OAuth in a popup; calls onConnected after the callback page posts a message. */
export function openGithubReviewerOAuthPopup(
  onConnected?: () => void,
): void {
  void api.get<{ url: string }>("/auth/github/reviewer").then(({ data }) => {
    const popup = window.open(
      data.url,
      "github-reviewer-auth",
      "width=600,height=700,popup=yes",
    );
    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.data?.type === "github-reviewer-connected"
      ) {
        window.removeEventListener("message", handleMessage);
        popup?.close();
        onConnected?.();
      }
    };
    window.addEventListener("message", handleMessage);
  });
}
