export const SKIP_SUBSCRIPTION_KEY = "skipSubscriptionCheck";

// ── Token Limits (per billing period / month) ──
// Calculated to ensure profitability even with Opus model usage:
// - Opus: ~$15/M input, ~$75/M output tokens
// - Assuming 70% input / 30% output ratio, blended cost ~$33/M tokens
// - Starter at $19/mo → ~500K tokens keeps margin positive
// - Team at $46/mo → ~1.5M tokens keeps margin positive

/** Max tokens per billing period for Starter plan. */
export const STARTER_MONTHLY_TOKENS = 500_000;

/** Max tokens per billing period for Team plan. */
export const TEAM_MONTHLY_TOKENS = 1_500_000;

/** Max tokens per billing period for Enterprise plan. */
export const ENTERPRISE_MONTHLY_TOKENS = 10_000_000;

// ── Error Codes ──

/** API `code` on 403 responses when monthly token limit is reached. */
export const API_ERROR_TOKEN_QUOTA_EXCEEDED = "TOKEN_QUOTA_EXCEEDED";
