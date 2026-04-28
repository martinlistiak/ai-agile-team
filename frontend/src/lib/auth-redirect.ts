const AUTH_REDIRECT_KEY = "runa_auth_redirect";

/** Same-origin path only; blocks open redirects. */
export function isSafeInternalPath(
  path: string | null | undefined,
): path is string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("://") || path.includes("..")) return false;
  return true;
}

function toInternalPath(url: URL): string {
  return `${url.pathname}${url.search}${url.hash}`;
}

export function getCurrentInternalPath(): string {
  if (typeof window === "undefined") return "/";
  return toInternalPath(new URL(window.location.href));
}

export function withNext(
  path: string,
  next: string | null | undefined,
): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://runa.invalid";
  const url = new URL(path, origin);
  if (isSafeInternalPath(next)) {
    url.searchParams.set("next", next);
  }
  return toInternalPath(url);
}

export function getLoginPath(next: string | null | undefined): string {
  return withNext("/login", next);
}

export function getForgotPasswordPath(
  next: string | null | undefined,
): string {
  return withNext("/login/forgot-password", next);
}

export function peekAuthRedirect(): string | null {
  const raw = sessionStorage.getItem(AUTH_REDIRECT_KEY);
  return isSafeInternalPath(raw) ? raw : null;
}

export function stashOAuthRedirect(next: string | null): void {
  if (isSafeInternalPath(next)) {
    sessionStorage.setItem(AUTH_REDIRECT_KEY, next);
  }
}

export function consumeAuthRedirect(): string | null {
  const raw = peekAuthRedirect();
  sessionStorage.removeItem(AUTH_REDIRECT_KEY);
  return isSafeInternalPath(raw) ? raw : null;
}
