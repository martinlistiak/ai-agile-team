const AUTH_REDIRECT_KEY = "runa_auth_redirect";

/** Same-origin path only; blocks open redirects. */
export function isSafeInternalPath(path: string | null): path is string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("://") || path.includes("..")) return false;
  return true;
}

export function stashOAuthRedirect(next: string | null): void {
  if (isSafeInternalPath(next)) {
    sessionStorage.setItem(AUTH_REDIRECT_KEY, next);
  }
}

export function consumeAuthRedirect(): string | null {
  const raw = sessionStorage.getItem(AUTH_REDIRECT_KEY);
  sessionStorage.removeItem(AUTH_REDIRECT_KEY);
  return isSafeInternalPath(raw) ? raw : null;
}
