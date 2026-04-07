import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Shared MiMo provider instance for all agent services.
 *
 * Xiaomi MiMo platform exposes an OpenAI-compatible API at
 * https://api.xiaomimimo.com/v1. All models (MiMo-V2-Pro, MiMo-V2-Flash)
 * are accessed through this single provider.
 *
 * Requires MIMO_API_KEY env var.
 */
export function createMimoProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "mimo",
    baseURL: process.env.MIMO_BASE_URL || "https://api.xiaomimimo.com/v1",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}
