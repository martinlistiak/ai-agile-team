type AgentType = "pm" | "developer" | "tester" | "reviewer";

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
