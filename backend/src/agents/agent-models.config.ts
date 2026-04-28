export type AgentType = "pm" | "developer" | "tester" | "reviewer" | "custom";

/**
 * Per-agent model configuration.
 *
 * Change these to use different models for each agent type.
 * Falls back to MIMO_MODEL env var, then to the default below.
 *
 * Models available on Xiaomi MiMo platform (OpenAI-compatible):
 *   "MiMo-V2-Pro"    — flagship reasoning/agent model (1T params, 42B active, 1M ctx)
 *   "MiMo-V2-Flash"  — fast MoE model (309B params, 15B active, 262K ctx)
 */
const AGENT_MODELS: Record<AgentType, string | null> = {
  pm: null, // null = use MIMO_MODEL env var or default
  developer: null,
  tester: null,
  reviewer: null,
  custom: null,
};

const DEFAULT_MODEL = "mimo-v2-pro";

/**
 * Resolve the model for a given agent type.
 * Priority: AGENT_MODELS config → MIMO_MODEL env var → DEFAULT_MODEL
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
  1: "mimo-v2-flash",
  2: "mimo-v2-flash",
  3: "mimo-v2-pro",
};

export function getModelForTier(tier: ModelTier): string {
  return MODEL_TIERS[tier];
}
