export const SKIP_SUBSCRIPTION_KEY = "skipSubscriptionCheck";

// ── Token Limits (per billing period / month) ──
// Limits are expressed in "cost-weighted tokens" — a normalized unit where
// 1 cost-weighted token ≈ 1 Sonnet input token in cost.
// This lets us compare usage across models and token types fairly.
//
// Pricing reference (per 1M tokens):
//   Haiku 4.5:  $1 input, $5 output, $0.10 cache-read, $1.25 cache-write
//   Sonnet 4:   $3 input, $15 output, $0.30 cache-read, $3.75 cache-write
//   Opus 4:     $15 input, $75 output, $1.50 cache-read, $18.75 cache-write
//
// We normalize everything relative to Sonnet input ($3/M) as the base unit.

/** Max cost-weighted tokens per billing period for Starter plan. */
export const STARTER_MONTHLY_TOKENS = 5_000_000;

/** Max cost-weighted tokens per billing period for Team plan. */
export const TEAM_MONTHLY_TOKENS = 20_000_000;

/** Max cost-weighted tokens per billing period for Enterprise plan. */
export const ENTERPRISE_MONTHLY_TOKENS = 10_000_000;

// ── Credit to Token Conversion ──
// $1 = 500,000 cost-weighted tokens (0.5M)

/** Cost-weighted tokens you get per $1 of credit top-up */
export const TOPUP_TOKENS_PER_DOLLAR = 500_000;

/** Cost-weighted tokens per cent of credit */
export const TOKENS_PER_CENT = TOPUP_TOKENS_PER_DOLLAR / 100; // 5000

/** Cost in cents per 1000 cost-weighted tokens (for display purposes) */
export const CENTS_PER_1K_TOKENS = Math.ceil(1000 / TOKENS_PER_CENT); // ~1 cent per 1K tokens

// ── Model Pricing (per 1M tokens, in USD) ──

interface ModelPricing {
  inputPerM: number;
  outputPerM: number;
  cacheReadPerM: number;
  cacheCreationPerM: number;
}

/**
 * Model pricing. Keys are matched against the model string
 * stored on executions (prefix match).
 *
 * MiMo-V2-Pro:  $1 input, $3 output (≤256K ctx)
 * MiMo-V2-Flash: $0.15 input, $0.60 output
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
  "mimo-v2-pro": {
    inputPerM: 1,
    outputPerM: 3,
    cacheReadPerM: 0.1,
    cacheCreationPerM: 1,
  },
  "mimo-v2-flash": {
    inputPerM: 0.15,
    outputPerM: 0.6,
    cacheReadPerM: 0.015,
    cacheCreationPerM: 0.15,
  },
  // Legacy Anthropic entries kept for historical execution records
  "claude-opus-4": {
    inputPerM: 15,
    outputPerM: 75,
    cacheReadPerM: 1.5,
    cacheCreationPerM: 18.75,
  },
  "claude-sonnet-4": {
    inputPerM: 3,
    outputPerM: 15,
    cacheReadPerM: 0.3,
    cacheCreationPerM: 3.75,
  },
  "claude-haiku-4": {
    inputPerM: 1,
    outputPerM: 5,
    cacheReadPerM: 0.1,
    cacheCreationPerM: 1.25,
  },
  "claude-haiku-3": {
    inputPerM: 0.25,
    outputPerM: 1.25,
    cacheReadPerM: 0.03,
    cacheCreationPerM: 0.3,
  },
};

/** Fallback pricing if model is unknown — uses MiMo-V2-Pro rates */
const DEFAULT_PRICING: ModelPricing = MODEL_PRICING["mimo-v2-pro"];

/** Base unit cost: MiMo-V2-Pro input $/M. All weights are relative to this. */
const BASE_COST_PER_M = 1; // MiMo-V2-Pro input

function getPricingForModel(modelUsed: string | null): ModelPricing {
  if (!modelUsed) return DEFAULT_PRICING;
  const lower = modelUsed.toLowerCase();
  for (const [prefix, pricing] of Object.entries(MODEL_PRICING)) {
    if (lower.startsWith(prefix)) return pricing;
  }
  return DEFAULT_PRICING;
}

/**
 * Compute cost-weighted tokens for an execution.
 *
 * Normalizes all token types to a single unit where 1 cost-weighted token
 * costs the same as 1 Sonnet input token. This accounts for:
 * - Different per-token costs across models (Haiku vs Sonnet vs Opus)
 * - Output tokens costing more than input tokens
 * - Cache read tokens being cheaper, cache creation tokens being more expensive
 */
export function computeCostWeightedTokens(params: {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  modelUsed: string | null;
}): number {
  const pricing = getPricingForModel(params.modelUsed);

  const inputCost = (params.inputTokens / 1_000_000) * pricing.inputPerM;
  const outputCost = (params.outputTokens / 1_000_000) * pricing.outputPerM;
  const cacheReadCost =
    (params.cacheReadTokens / 1_000_000) * pricing.cacheReadPerM;
  const cacheCreationCost =
    (params.cacheCreationTokens / 1_000_000) * pricing.cacheCreationPerM;

  const totalCostUsd =
    inputCost + outputCost + cacheReadCost + cacheCreationCost;

  // Convert back to cost-weighted tokens (relative to base unit)
  return Math.ceil(totalCostUsd * (1_000_000 / BASE_COST_PER_M));
}

// ── Error Codes ──

/** API `code` on 403 responses when monthly token limit is reached. */
export const API_ERROR_TOKEN_QUOTA_EXCEEDED = "TOKEN_QUOTA_EXCEEDED";
