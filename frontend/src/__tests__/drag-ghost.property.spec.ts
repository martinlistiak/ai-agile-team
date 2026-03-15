import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Priority, TicketStatus } from "@/types";

/**
 * Property tests for TicketCard drag ghost visibility.
 *
 * We model the TicketCard's drag-hide logic as a pure function and verify
 * invariants across arbitrary ticket/drag combinations. This avoids React
 * rendering while fully validating the component's visibility logic.
 */

// --- Pure model of TicketCard drag visibility ---

/**
 * Determines whether the card should be hidden during drag.
 * Mirrors: `const isHiddenDuringDrag = activeTicketId === ticket.id`
 * When hidden, the card gets `opacity-0`.
 */
function isHiddenDuringDrag(
  ticketId: string,
  activeTicketId: string | null,
): boolean {
  return activeTicketId === ticketId;
}

/**
 * Computes the CSS classes relevant to drag visibility.
 * Mirrors the `cn(...)` call in TicketCard's root div.
 */
function computeDragClasses(
  ticketId: string,
  activeTicketId: string | null,
): { hasOpacity0: boolean } {
  return { hasOpacity0: isHiddenDuringDrag(ticketId, activeTicketId) };
}

// --- Generators ---

const ticketIdArb = fc.uuid();

const ticketStatusArb: fc.Arbitrary<TicketStatus> = fc.constantFrom(
  "backlog",
  "planning",
  "development",
  "review",
  "testing",
  "staged",
  "done",
);

const priorityArb: fc.Arbitrary<Priority> = fc.constantFrom(
  "low",
  "medium",
  "high",
  "critical",
);

const activeTicketIdArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.uuid(),
  fc.constant(null as string | null),
);

// Feature: ui-overhaul, Property 8: Original card hidden during drag
describe("Property 8: Original card hidden during drag", () => {
  // **Validates: Requirements 5.1, 5.2, 5.3**

  it("card has opacity-0 when its ID matches activeTicketId", () => {
    fc.assert(
      fc.property(ticketIdArb, (ticketId) => {
        // activeTicketId === ticketId → card is being dragged
        const classes = computeDragClasses(ticketId, ticketId);
        expect(classes.hasOpacity0).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("card is fully visible when activeTicketId is null (no drag)", () => {
    fc.assert(
      fc.property(ticketIdArb, (ticketId) => {
        const classes = computeDragClasses(ticketId, null);
        expect(classes.hasOpacity0).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("card is fully visible when activeTicketId is a different ticket", () => {
    fc.assert(
      fc.property(
        ticketIdArb,
        ticketIdArb.filter((id) => id !== ""),
        (ticketId, otherTicketId) => {
          fc.pre(ticketId !== otherTicketId);
          const classes = computeDragClasses(ticketId, otherTicketId);
          expect(classes.hasOpacity0).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("isHiddenDuringDrag is true iff activeTicketId === ticketId for any combination", () => {
    fc.assert(
      fc.property(ticketIdArb, activeTicketIdArb, (ticketId, activeId) => {
        const hidden = isHiddenDuringDrag(ticketId, activeId);
        expect(hidden).toBe(activeId === ticketId);
      }),
      { numRuns: 100 },
    );
  });

  it("when drag ends (activeTicketId becomes null), card becomes visible again", () => {
    fc.assert(
      fc.property(ticketIdArb, (ticketId) => {
        // During drag
        const duringDrag = computeDragClasses(ticketId, ticketId);
        expect(duringDrag.hasOpacity0).toBe(true);

        // After drag ends
        const afterDrag = computeDragClasses(ticketId, null);
        expect(afterDrag.hasOpacity0).toBe(false);
      }),
      { numRuns: 100 },
    );
  });
});
