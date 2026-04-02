export type AgentType = "pm" | "developer" | "tester" | "reviewer" | "custom";

/**
 * Per-agent model configuration.
 *
 * Change these to use different models for each agent type.
 * Falls back to ANTHROPIC_MODEL env var, then to the default below.
 *
 * Examples:
 *   "claude-sonnet-4-20250514"
 *   "claude-opus-4-20250514"
 *   "claude-haiku-3-5-20241022"
 *   "claude-sonnet-4-6"
 *   "claude-opus-4-6"
 */
const AGENT_MODELS: Record<AgentType, string | null> = {
  pm: null, // null = use ANTHROPIC_MODEL env var or default
  developer: null,
  tester: null,
  reviewer: null,
  custom: null,
};

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

/**
 * Resolve the model for a given agent type.
 * Priority: AGENT_MODELS config → ANTHROPIC_MODEL env var → DEFAULT_MODEL
 */
export function getModelForAgent(
  agentType: AgentType,
  envModel?: string,
): string {
  return AGENT_MODELS[agentType] ?? envModel ?? DEFAULT_MODEL;
}

/**
 * Tiered model routing configuration.
 * Tier 1 (fast/cheap) → Tier 2 (balanced) → Tier 3 (powerful)
 */
export type ModelTier = 1 | 2 | 3;

export const MODEL_TIERS: Record<ModelTier, string> = {
  1: "claude-haiku-4-5-20251001",
  2: "claude-sonnet-4-20250514",
  3: "claude-opus-4-20250514",
};

export function getModelForTier(tier: ModelTier): string {
  return MODEL_TIERS[tier];
}
