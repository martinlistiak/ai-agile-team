import { ConfigService } from "@nestjs/config";

/** Appended to agent system prompts to reduce verbose model output (lower output tokens). */
const COMPACT_OUTPUT_SUFFIX = `

# Brevity (token efficiency)
- Use the fewest words that still convey the answer. No filler, apologies, or “I will / let me / here is”.
- Prefer terse bullets and fragments. Skip repeated context.
- Never drop technical facts: file paths, identifiers, commands, errors, API names, verdict lines, and structured fields must stay complete and accurate.
- When a required format exists (reviews, tickets, JSON), satisfy it fully in fewer words.`;

function compactOutputDisabled(config: ConfigService): boolean {
  const v = config.get<string>("RUNA_COMPACT_AGENT_OUTPUT");
  if (v === undefined || v === "") return false;
  return /^(false|0|no|off)$/i.test(v.trim());
}

/** When enabled (default), appends brevity instructions so models emit shorter replies. */
export function appendCompactOutputStyle(
  systemPrompt: string,
  config: ConfigService,
): string {
  if (compactOutputDisabled(config)) return systemPrompt;
  return systemPrompt + COMPACT_OUTPUT_SUFFIX;
}
