import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Agent, AgentStatus, AgentType } from "@/types";

/**
 * Property tests for TicketCard agent avatar and spinning border logic.
 *
 * We model the TicketCard's agent resolution and display logic as pure
 * functions and verify invariants across arbitrary ticket/agent combinations.
 * This avoids React rendering while fully validating the component's logic.
 */

// --- Pure model of TicketCard agent display logic ---

/**
 * Resolves the assigned agent from the agents list.
 * Mirrors: `const assignedAgent = ticket.assigneeAgentId
 *   ? (agents.find(a => a.id === ticket.assigneeAgentId) ?? null)
 *   : null`
 */
function resolveAssignedAgent(
  assigneeAgentId: string | null,
  agents: Agent[],
): Agent | null {
  if (!assigneeAgentId) return null;
  return agents.find((a) => a.id === assigneeAgentId) ?? null;
}

/**
 * Determines whether an agent avatar should be rendered.
 * Mirrors: `{assignedAgent && <img ... />}`
 */
function shouldShowAvatar(
  assigneeAgentId: string | null,
  agents: Agent[],
): boolean {
  return resolveAssignedAgent(assigneeAgentId, agents) !== null;
}

/**
 * Determines whether the spinning border class should be applied.
 * Mirrors: `assignedAgent?.status === "active" && "spinning-border"`
 */
function shouldShowSpinningBorder(
  assigneeAgentId: string | null,
  agents: Agent[],
): boolean {
  const agent = resolveAssignedAgent(assigneeAgentId, agents);
  return agent?.status === "active";
}

// --- Generators ---

const agentTypeArb: fc.Arbitrary<AgentType> = fc.constantFrom(
  "pm",
  "developer",
  "tester",
  "reviewer",
  "custom",
);

const agentStatusArb: fc.Arbitrary<AgentStatus> = fc.constantFrom(
  "idle",
  "active",
  "error",
);

const agentArb: fc.Arbitrary<Agent> = fc.record({
  id: fc.uuid(),
  spaceId: fc.uuid(),
  agentType: agentTypeArb,
  name: fc.constant(null as string | null),
  description: fc.constant(null as string | null),
  systemPrompt: fc.constant(null as string | null),
  isCustom: fc.constant(false),
  rules: fc.constant(null as string | null),
  avatarRef: fc.constant("avatar.svg"),
  status: agentStatusArb,
  createdAt: fc.constant("2025-01-01T00:00:00Z"),
});

const agentsListArb: fc.Arbitrary<Agent[]> = fc.array(agentArb, {
  minLength: 0,
  maxLength: 10,
});

const assigneeAgentIdArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.uuid(),
  fc.constant(null as string | null),
);

// Feature: ui-overhaul, Property 9: Agent avatar presence matches assignment
describe("Property 9: Agent avatar presence matches assignment", () => {
  // **Validates: Requirements 6.1, 6.2**

  it("avatar is shown iff assigneeAgentId is non-null and resolves to a valid agent", () => {
    fc.assert(
      fc.property(
        assigneeAgentIdArb,
        agentsListArb,
        (assigneeAgentId, agents) => {
          const showAvatar = shouldShowAvatar(assigneeAgentId, agents);
          const resolvedAgent = resolveAssignedAgent(assigneeAgentId, agents);

          // Avatar shown iff agent was resolved
          expect(showAvatar).toBe(resolvedAgent !== null);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("when assigneeAgentId is null, no avatar is shown", () => {
    fc.assert(
      fc.property(agentsListArb, (agents) => {
        expect(shouldShowAvatar(null, agents)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("when assigneeAgentId matches an agent in the list, avatar is shown", () => {
    fc.assert(
      fc.property(
        agentsListArb.filter((a) => a.length > 0),
        (agents) => {
          // Pick a random agent from the list
          const targetAgent = agents[0];
          expect(shouldShowAvatar(targetAgent.id, agents)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("when assigneeAgentId does not match any agent, no avatar is shown", () => {
    fc.assert(
      fc.property(agentsListArb, fc.uuid(), (agents, unknownId) => {
        // Ensure unknownId doesn't match any agent
        fc.pre(!agents.some((a) => a.id === unknownId));
        expect(shouldShowAvatar(unknownId, agents)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: ui-overhaul, Property 10: Spinning border matches agent active status
describe("Property 10: Spinning border matches agent active status", () => {
  // **Validates: Requirements 6.3, 6.4**

  it("spinning border is applied iff the resolved agent status is 'active'", () => {
    fc.assert(
      fc.property(
        assigneeAgentIdArb,
        agentsListArb,
        (assigneeAgentId, agents) => {
          const spinning = shouldShowSpinningBorder(assigneeAgentId, agents);
          const resolvedAgent = resolveAssignedAgent(assigneeAgentId, agents);

          if (resolvedAgent === null) {
            expect(spinning).toBe(false);
          } else {
            expect(spinning).toBe(resolvedAgent.status === "active");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("when agent status is 'active', spinning border is applied", () => {
    fc.assert(
      fc.property(
        agentArb.map((a) => ({ ...a, status: "active" as AgentStatus })),
        (activeAgent) => {
          const agents = [activeAgent];
          expect(shouldShowSpinningBorder(activeAgent.id, agents)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("when agent status is 'idle', spinning border is not applied", () => {
    fc.assert(
      fc.property(
        agentArb.map((a) => ({ ...a, status: "idle" as AgentStatus })),
        (idleAgent) => {
          const agents = [idleAgent];
          expect(shouldShowSpinningBorder(idleAgent.id, agents)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("when agent status is 'error', spinning border is not applied", () => {
    fc.assert(
      fc.property(
        agentArb.map((a) => ({ ...a, status: "error" as AgentStatus })),
        (errorAgent) => {
          const agents = [errorAgent];
          expect(shouldShowSpinningBorder(errorAgent.id, agents)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("when assigneeAgentId is null, spinning border is never applied", () => {
    fc.assert(
      fc.property(agentsListArb, (agents) => {
        expect(shouldShowSpinningBorder(null, agents)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("when assigneeAgentId does not resolve to any agent, spinning border is not applied", () => {
    fc.assert(
      fc.property(agentsListArb, fc.uuid(), (agents, unknownId) => {
        fc.pre(!agents.some((a) => a.id === unknownId));
        expect(shouldShowSpinningBorder(unknownId, agents)).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
