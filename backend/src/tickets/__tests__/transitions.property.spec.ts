import * as fc from "fast-check";
import { TicketsService } from "../tickets.service";

/**
 * Property 8: Status transitions are recorded with correct metadata
 *
 * For any ticket and any status change operation, the statusHistory JSONB array
 * should grow by exactly one entry, and that entry must contain the correct
 * `from` (previous status), `to` (new status), a valid ISO timestamp, and the
 * correct `trigger` source ('user', 'agent', or 'pipeline').
 *
 * **Validates: Requirements 6.1, 6.3**
 */

const STATUSES = [
  "backlog",
  "planning",
  "development",
  "review",
  "testing",
  "staged",
  "done",
] as const;

const TRIGGERS = ["user", "agent", "pipeline"] as const;

describe("Property 8: Status transitions are recorded with correct metadata", () => {
  let service: TicketsService;
  let mockRepo: any;
  let mockEventEmitter: any;

  beforeEach(() => {
    mockRepo = {
      findOneBy: jest.fn(),
      save: jest.fn((ticket: any) => Promise.resolve({ ...ticket })),
    };
    mockEventEmitter = {
      emit: jest.fn(),
    };
    service = new TicketsService(mockRepo, {} as any, mockEventEmitter);
  });

  it("moveTicket should append exactly one transition entry with correct from/to/timestamp/trigger", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...STATUSES),
        fc.constantFrom(...STATUSES),
        fc.constantFrom(...TRIGGERS),
        async (fromStatus, toStatus, trigger) => {
          // Skip same-status transitions (no entry should be added)
          fc.pre(fromStatus !== toStatus);

          const existingHistory = [
            {
              from: "backlog",
              to: "planning",
              timestamp: "2024-01-01T00:00:00.000Z",
              trigger: "user" as const,
            },
          ];

          const ticket = {
            id: "ticket-1",
            status: fromStatus,
            statusHistory: [...existingHistory],
          };

          mockRepo.findOneBy.mockResolvedValue(ticket);

          const beforeTime = new Date().toISOString();
          const result = await service.moveTicket(
            "ticket-1",
            toStatus,
            trigger,
          );
          const afterTime = new Date().toISOString();

          // statusHistory should grow by exactly 1
          expect(result.statusHistory.length).toBe(existingHistory.length + 1);

          // The new entry should be the last one
          const newEntry =
            result.statusHistory[result.statusHistory.length - 1];

          // Correct from/to
          expect(newEntry.from).toBe(fromStatus);
          expect(newEntry.to).toBe(toStatus);

          // Correct trigger
          expect(newEntry.trigger).toBe(trigger);

          // Valid ISO timestamp within the execution window
          expect(() => new Date(newEntry.timestamp)).not.toThrow();
          expect(newEntry.timestamp >= beforeTime).toBe(true);
          expect(newEntry.timestamp <= afterTime).toBe(true);

          // Existing history entries should be preserved
          expect(result.statusHistory.slice(0, existingHistory.length)).toEqual(
            existingHistory,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("moveTicket should not add a transition entry when status does not change", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...STATUSES),
        fc.constantFrom(...TRIGGERS),
        async (status, trigger) => {
          const existingHistory = [
            {
              from: "backlog",
              to: "planning",
              timestamp: "2024-01-01T00:00:00.000Z",
              trigger: "user" as const,
            },
          ];

          const ticket = {
            id: "ticket-1",
            status: status,
            statusHistory: [...existingHistory],
          };

          mockRepo.findOneBy.mockResolvedValue(ticket);

          const result = await service.moveTicket("ticket-1", status, trigger);

          // statusHistory should remain unchanged
          expect(result.statusHistory.length).toBe(existingHistory.length);
          expect(result.statusHistory).toEqual(existingHistory);
        },
      ),
      { numRuns: 100 },
    );
  });
});
