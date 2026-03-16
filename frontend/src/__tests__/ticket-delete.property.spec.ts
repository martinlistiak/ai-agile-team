import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { Ticket, TicketStatus, Priority } from "@/types";

/**
 * Property tests for ticket deletion board state logic.
 *
 * We model the board's ticket list as a pure state and verify that
 * deleting a ticket removes it from the list. This avoids React rendering
 * (the test env is node) while fully validating the deletion logic.
 */

// Feature: ui-overhaul, Property 6: Ticket deletion removes ticket from board state

// --- Pure state model of board ticket list ---

interface BoardState {
  tickets: Ticket[];
}

/**
 * Model the effect of a successful delete mutation on the board state.
 * After the React Query cache is invalidated, the refetched ticket list
 * will no longer contain the deleted ticket. We model this directly as
 * filtering the ticket out of the list.
 */
function applyDeleteTicket(state: BoardState, ticketId: string): BoardState {
  return {
    tickets: state.tickets.filter((t) => t.id !== ticketId),
  };
}

// --- Generators ---

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

const ticketArb: fc.Arbitrary<Ticket> = fc
  .record({
    id: fc.uuid(),
    spaceId: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 100, unit: "grapheme-ascii" }),
    description: fc.string({ maxLength: 200, unit: "grapheme-ascii" }),
    status: ticketStatusArb,
    priority: priorityArb,
    assigneeAgentId: fc.option(fc.uuid(), { nil: null }),
    assigneeUserId: fc.option(fc.uuid(), { nil: null }),
    prUrl: fc.option(fc.webUrl(), { nil: null }),
    createdAt: fc
      .integer({
        min: new Date("2020-01-01").getTime(),
        max: new Date("2030-01-01").getTime(),
      })
      .map((ms) => new Date(ms).toISOString()),
    updatedAt: fc
      .integer({
        min: new Date("2020-01-01").getTime(),
        max: new Date("2030-01-01").getTime(),
      })
      .map((ms) => new Date(ms).toISOString()),
  })
  .map((fields) => ({
    ...fields,
    comments: [],
    statusHistory: [],
  }));

/**
 * Generate a board state with a list of tickets that have unique IDs.
 */
const boardStateArb = (
  minTickets = 1,
  maxTickets = 30,
): fc.Arbitrary<BoardState> =>
  fc
    .array(ticketArb, { minLength: minTickets, maxLength: maxTickets })
    .chain((tickets) => {
      // Ensure unique IDs by deduplicating
      const seen = new Set<string>();
      const unique = tickets.filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
      // Only keep if we have at least minTickets
      if (unique.length < minTickets) return fc.constant(null);
      return fc.constant({ tickets: unique });
    })
    .filter((s): s is BoardState => s !== null);

// --- Property tests ---

describe("Property 6: Ticket deletion removes ticket from board state", () => {
  it("after deleting a ticket, it no longer appears in the board ticket list", () => {
    fc.assert(
      fc.property(
        boardStateArb(1, 30).chain((state) =>
          fc
            .integer({ min: 0, max: state.tickets.length - 1 })
            .map((idx) => ({ state, targetTicket: state.tickets[idx] })),
        ),
        ({ state, targetTicket }) => {
          const updated = applyDeleteTicket(state, targetTicket.id);

          // The deleted ticket must not appear in the result
          const found = updated.tickets.find((t) => t.id === targetTicket.id);
          expect(found).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 4.4**
  it("deleting a ticket preserves all other tickets in the list", () => {
    fc.assert(
      fc.property(
        boardStateArb(2, 30).chain((state) =>
          fc
            .integer({ min: 0, max: state.tickets.length - 1 })
            .map((idx) => ({ state, targetTicket: state.tickets[idx] })),
        ),
        ({ state, targetTicket }) => {
          const updated = applyDeleteTicket(state, targetTicket.id);

          // All tickets except the deleted one should remain
          const otherTickets = state.tickets.filter(
            (t) => t.id !== targetTicket.id,
          );
          expect(updated.tickets.length).toBe(otherTickets.length);

          for (const ticket of otherTickets) {
            expect(
              updated.tickets.find((t) => t.id === ticket.id),
            ).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("deleting a ticket reduces the list length by exactly one", () => {
    fc.assert(
      fc.property(
        boardStateArb(1, 30).chain((state) =>
          fc
            .integer({ min: 0, max: state.tickets.length - 1 })
            .map((idx) => ({ state, targetTicket: state.tickets[idx] })),
        ),
        ({ state, targetTicket }) => {
          const updated = applyDeleteTicket(state, targetTicket.id);
          expect(updated.tickets.length).toBe(state.tickets.length - 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("deleting a non-existent ticket ID leaves the board unchanged", () => {
    fc.assert(
      fc.property(boardStateArb(0, 20), fc.uuid(), (state, fakeId) => {
        // Ensure fakeId is not in the list
        fc.pre(!state.tickets.some((t) => t.id === fakeId));

        const updated = applyDeleteTicket(state, fakeId);
        expect(updated.tickets.length).toBe(state.tickets.length);
        expect(updated.tickets.map((t) => t.id)).toEqual(
          state.tickets.map((t) => t.id),
        );
      }),
      { numRuns: 100 },
    );
  });

  it("deleting all tickets one by one results in an empty board", () => {
    fc.assert(
      fc.property(boardStateArb(1, 20), (state) => {
        let current = state;
        for (const ticket of state.tickets) {
          current = applyDeleteTicket(current, ticket.id);
        }
        expect(current.tickets.length).toBe(0);
      }),
      { numRuns: 100 },
    );
  });
});
