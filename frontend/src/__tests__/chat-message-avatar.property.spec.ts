import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { AgentType, ChatMessage } from "@/types";
import { getAvatarSrc } from "@/lib/avatars";

/**
 * Property tests for chat message avatar rendering.
 *
 * We model the ChatBubble rendering logic as a pure function (matching
 * the internal ChatBubble component in ChatModal.tsx) and verify avatar
 * invariants across arbitrary ChatMessage inputs.
 */

// Feature: ui-overhaul, Property 12: Agent messages render with avatar, user messages without

// --- Pure model of ChatBubble avatar logic ---

interface AvatarResult {
  hasAvatar: boolean;
  avatarSrc: string | null;
}

/**
 * Models the avatar rendering decision from ChatBubble in ChatModal.tsx:
 *   - If role !== "user" AND agentType is defined → render <img> with getAvatarSrc(agentType)
 *   - Otherwise → no avatar
 */
function computeAvatarPresence(message: ChatMessage): AvatarResult {
  const isUser = message.role === "user";
  if (!isUser && message.agentType) {
    return { hasAvatar: true, avatarSrc: getAvatarSrc(message.agentType) };
  }
  return { hasAvatar: false, avatarSrc: null };
}

// --- Generators ---

const agentTypeArb: fc.Arbitrary<AgentType> = fc.constantFrom(
  "pm",
  "developer",
  "tester",
  "reviewer",
  "custom",
);

const chatMessageBaseArb = fc.record({
  id: fc.uuid(),
  content: fc.string({ minLength: 0, maxLength: 200 }),
  timestamp: fc
    .date({
      min: new Date("2000-01-01"),
      max: new Date("2030-01-01"),
      noInvalidDate: true,
    })
    .map((d) => d.toISOString()),
  attachments: fc.constant([] as ChatMessage["attachments"]),
});

const assistantMessageArb: fc.Arbitrary<ChatMessage> = fc
  .tuple(chatMessageBaseArb, agentTypeArb)
  .map(([base, agentType]) => ({
    ...base,
    role: "assistant" as const,
    agentType: agentType as string,
  }));

const userMessageArb: fc.Arbitrary<ChatMessage> = chatMessageBaseArb.map(
  (base) => ({
    ...base,
    role: "user" as const,
  }),
);

const anyChatMessageArb: fc.Arbitrary<ChatMessage> = fc.oneof(
  assistantMessageArb,
  userMessageArb,
);

// --- Tests ---

// **Validates: Requirements 9.2**
describe("Property 12: Agent messages render with avatar, user messages without", () => {
  it("assistant messages with agentType always produce an avatar with correct src", () => {
    fc.assert(
      fc.property(assistantMessageArb, (message) => {
        const result = computeAvatarPresence(message);
        expect(result.hasAvatar).toBe(true);
        expect(result.avatarSrc).toBe(getAvatarSrc(message.agentType!));
      }),
      { numRuns: 100 },
    );
  });

  it("user messages never produce an avatar", () => {
    fc.assert(
      fc.property(userMessageArb, (message) => {
        const result = computeAvatarPresence(message);
        expect(result.hasAvatar).toBe(false);
        expect(result.avatarSrc).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("for any ChatMessage, avatar presence is determined solely by role and agentType", () => {
    fc.assert(
      fc.property(anyChatMessageArb, (message) => {
        const result = computeAvatarPresence(message);
        if (message.role === "assistant" && message.agentType) {
          expect(result.hasAvatar).toBe(true);
          expect(result.avatarSrc).toBe(getAvatarSrc(message.agentType));
        } else {
          expect(result.hasAvatar).toBe(false);
          expect(result.avatarSrc).toBeNull();
        }
      }),
      { numRuns: 100 },
    );
  });

  it("avatar src always matches the /avatars/{type}.svg pattern for agent messages", () => {
    fc.assert(
      fc.property(agentTypeArb, (agentType) => {
        const src = getAvatarSrc(agentType);
        if (agentType === "custom") {
          expect(src).toBe("/avatars/custom.svg");
        } else {
          expect(src).toBe(`/avatars/${agentType}.svg`);
        }
      }),
      { numRuns: 100 },
    );
  });
});
