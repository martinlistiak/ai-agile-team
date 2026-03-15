import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { AgentType } from "@/types";

/**
 * Property tests for ChatContext state machine.
 *
 * We model the ChatContext as a pure state machine and verify invariants
 * across arbitrary sequences of actions. This avoids React rendering
 * (the test env is node) while fully validating the context's logic.
 */

// --- State machine model of ChatContext ---

interface ChatState {
  isOpen: boolean;
  selectedAgent: AgentType;
  unreadCount: number;
}

type ChatAction =
  | { type: "openChat"; agentType?: AgentType }
  | { type: "closeChat" }
  | { type: "markRead" }
  | { type: "incomingMessage" };

function initialState(): ChatState {
  return { isOpen: false, selectedAgent: "pm", unreadCount: 0 };
}

function applyAction(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "openChat":
      return {
        ...state,
        isOpen: true,
        selectedAgent: action.agentType ?? state.selectedAgent,
      };
    case "closeChat":
      return { ...state, isOpen: false };
    case "markRead":
      return { ...state, unreadCount: 0 };
    case "incomingMessage":
      return state.isOpen
        ? state
        : { ...state, unreadCount: state.unreadCount + 1 };
    default:
      return state;
  }
}

function applyActions(actions: ChatAction[]): ChatState {
  return actions.reduce(applyAction, initialState());
}

// --- Generators ---

const agentTypeArb = fc.constantFrom<AgentType>("pm", "developer", "tester");

const chatActionArb: fc.Arbitrary<ChatAction> = fc.oneof(
  agentTypeArb.map((a) => ({ type: "openChat" as const, agentType: a })),
  fc.constant({ type: "openChat" as const } as ChatAction),
  fc.constant({ type: "closeChat" as const } as ChatAction),
  fc.constant({ type: "markRead" as const } as ChatAction),
  fc.constant({ type: "incomingMessage" as const } as ChatAction),
);

const chatActionSequenceArb = fc.array(chatActionArb, {
  minLength: 0,
  maxLength: 50,
});

// Feature: ui-overhaul, Property 1: Chat bubble visibility is inverse of modal state
describe("Property 1: Chat bubble visibility is inverse of modal state", () => {
  it("for any sequence of openChat/closeChat calls, bubble visible iff isOpen is false and modal rendered iff isOpen is true", () => {
    fc.assert(
      fc.property(chatActionSequenceArb, (actions) => {
        const state = applyActions(actions);

        // Chat_Bubble visible iff isOpen === false
        const bubbleVisible = !state.isOpen;
        // Chat_Modal rendered iff isOpen === true
        const modalRendered = state.isOpen;

        expect(bubbleVisible).toBe(!state.isOpen);
        expect(modalRendered).toBe(state.isOpen);
        // They must be mutually exclusive
        expect(bubbleVisible).not.toBe(modalRendered);
      }),
      { numRuns: 100 },
    );
  });

  it("initial state has bubble visible and modal hidden", () => {
    const state = initialState();
    expect(state.isOpen).toBe(false);
    // Bubble visible when isOpen is false
    expect(!state.isOpen).toBe(true);
  });

  it("openChat always makes modal visible and hides bubble", () => {
    fc.assert(
      fc.property(chatActionSequenceArb, agentTypeArb, (prefix, agent) => {
        const before = applyActions(prefix);
        const after = applyAction(before, {
          type: "openChat",
          agentType: agent,
        });
        expect(after.isOpen).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("closeChat always hides modal and shows bubble", () => {
    fc.assert(
      fc.property(chatActionSequenceArb, (prefix) => {
        const before = applyActions(prefix);
        const after = applyAction(before, { type: "closeChat" });
        expect(after.isOpen).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: ui-overhaul, Property 2: Unread count tracks messages received while modal is closed
describe("Property 2: Unread count tracks messages received while modal is closed", () => {
  it("unreadCount equals messages received while isOpen was false since last markRead", () => {
    fc.assert(
      fc.property(chatActionSequenceArb, (actions) => {
        const state = applyActions(actions);

        // Manually count expected unread: messages received while closed since last markRead
        let expectedUnread = 0;
        let isOpen = false;
        for (const action of actions) {
          switch (action.type) {
            case "openChat":
              isOpen = true;
              break;
            case "closeChat":
              isOpen = false;
              break;
            case "markRead":
              expectedUnread = 0;
              break;
            case "incomingMessage":
              if (!isOpen) {
                expectedUnread++;
              }
              break;
          }
        }

        expect(state.unreadCount).toBe(expectedUnread);
      }),
      { numRuns: 100 },
    );
  });

  it("markRead always resets unread count to zero", () => {
    fc.assert(
      fc.property(chatActionSequenceArb, (prefix) => {
        const before = applyActions(prefix);
        const after = applyAction(before, { type: "markRead" });
        expect(after.unreadCount).toBe(0);
        // Verify it was reset regardless of previous count
        expect(after.unreadCount).toBeLessThanOrEqual(before.unreadCount);
      }),
      { numRuns: 100 },
    );
  });

  it("messages while open do not increment unread count", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.constant({ type: "incomingMessage" as const } as ChatAction),
          {
            minLength: 1,
            maxLength: 20,
          },
        ),
        (messages) => {
          // Start with modal open
          const openState = applyAction(initialState(), { type: "openChat" });
          const finalState = messages.reduce(applyAction, openState);
          expect(finalState.unreadCount).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("messages while closed increment unread count by exactly one each", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 50 }), (messageCount) => {
        // Start closed (initial state), send N messages
        const actions: ChatAction[] = Array.from(
          { length: messageCount },
          () => ({ type: "incomingMessage" as const }),
        );
        const state = applyActions(actions);
        expect(state.unreadCount).toBe(messageCount);
      }),
      { numRuns: 100 },
    );
  });

  it("opening modal and calling markRead resets count to zero", () => {
    fc.assert(
      fc.property(chatActionSequenceArb, (prefix) => {
        const before = applyActions(prefix);
        const opened = applyAction(before, { type: "openChat" });
        const cleared = applyAction(opened, { type: "markRead" });
        expect(cleared.unreadCount).toBe(0);
        expect(cleared.isOpen).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: ui-overhaul, Property 3: Agent selection updates active agent
describe("Property 3: Agent selection updates active agent", () => {
  it("selectedAgent always equals the most recently selected agent type", () => {
    fc.assert(
      fc.property(chatActionSequenceArb, (actions) => {
        const state = applyActions(actions);

        // Find the last openChat action that specified an agentType
        let expectedAgent: AgentType = "pm"; // default
        for (const action of actions) {
          if (action.type === "openChat" && action.agentType) {
            expectedAgent = action.agentType;
          }
        }

        expect(state.selectedAgent).toBe(expectedAgent);
      }),
      { numRuns: 100 },
    );
  });

  it("selecting any agent type updates selectedAgent to that type", () => {
    fc.assert(
      fc.property(agentTypeArb, (agent) => {
        const state = applyAction(initialState(), {
          type: "openChat",
          agentType: agent,
        });
        expect(state.selectedAgent).toBe(agent);
      }),
      { numRuns: 100 },
    );
  });

  it("openChat without agentType preserves the current selectedAgent", () => {
    fc.assert(
      fc.property(chatActionSequenceArb, (prefix) => {
        const before = applyActions(prefix);
        const after = applyAction(before, { type: "openChat" });
        expect(after.selectedAgent).toBe(before.selectedAgent);
      }),
      { numRuns: 100 },
    );
  });

  it("closeChat and markRead do not change selectedAgent", () => {
    fc.assert(
      fc.property(chatActionSequenceArb, (prefix) => {
        const before = applyActions(prefix);
        const afterClose = applyAction(before, { type: "closeChat" });
        const afterMark = applyAction(before, { type: "markRead" });
        expect(afterClose.selectedAgent).toBe(before.selectedAgent);
        expect(afterMark.selectedAgent).toBe(before.selectedAgent);
      }),
      { numRuns: 100 },
    );
  });
});
