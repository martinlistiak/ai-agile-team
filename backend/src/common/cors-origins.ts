/**
 * Browser origins allowed for CORS / Socket.IO.
 * Set CORS_ORIGIN to a comma-separated list to override (e.g. local-only).
 */
export function getCorsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }
  return ["http://localhost:3000", "https://runa-app.com"];
}
