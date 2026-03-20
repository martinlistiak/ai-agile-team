/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_COUNTLY_APP_KEY?: string;
  readonly VITE_COUNTLY_SERVER_URL?: string;
  /** Cloudflare Turnstile site key (optional; pair with backend TURNSTILE_SECRET_KEY) */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
