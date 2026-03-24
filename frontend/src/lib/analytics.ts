import Countly from "countly-sdk-web";

let initialized = false;

function normalizeServerUrl(url: string): string {
  return url.replace(/\/$/, "");
}

export function initAnalytics(): void {
  const appKey = import.meta.env.VITE_COUNTLY_APP_KEY;
  console.log(appKey);
  const url = import.meta.env.VITE_COUNTLY_SERVER_URL;
  if (!appKey || !url || initialized) return;

  Countly.init({
    app_key: appKey,
    url: normalizeServerUrl(url),
  });
  Countly.q.push(["track_sessions"]);
  Countly.q.push(["track_pageview"]);
  initialized = true;
}

/**
 * Call on route changes (SPA navigation) so Countly records each view.
 */
export function trackPageview(path?: string): void {
  if (!initialized) return;
  Countly.q.push(["track_pageview", path ?? window.location.pathname]);
}

export function setAnalyticsUserId(userId: string | null): void {
  if (!initialized || !userId) return;
  Countly.change_id(userId, true);
}

export function trackEvent(
  key: string,
  segmentation?: Record<string, string | number | boolean>,
): void {
  if (!initialized) return;
  const seg = segmentation
    ? Object.fromEntries(
        Object.entries(segmentation).map(([k, v]) => [k, String(v)]),
      )
    : undefined;
  Countly.add_event({ key, segmentation: seg });
}
