import type { AgentStatus, AgentType } from "@/types";

/**
 * Maps an agent status to the corresponding CSS ring class for the avatar status ring.
 *
 * - idle  → gray ring
 * - active → green pulsing ring
 * - error → red ring
 */
export function getStatusRingClass(status: AgentStatus): string {
  switch (status) {
    case "idle":
      return "ring-2 ring-gray-400";
    case "active":
      return "ring-2 ring-green-400 animate-pulse-dot";
    case "error":
      return "ring-2 ring-red-500";
  }
}

/** Returns the public avatar path for a given agent type. */
export function getAvatarSrc(agentType: AgentType): string {
  return `/avatars/${agentType}.svg`;
}
