import * as fc from "fast-check";
import { NotFoundException } from "@nestjs/common";
import { TicketsService } from "../tickets.service";

// Feature: ui-overhaul, Property 7: Backend ticket deletion removes ticket and comments

/**
 * Property 7: Backend ticket deletion removes ticket and comments
 *
 * For any ticket with any number of inline comments, calling
 * ticketsService.delete(ticket.id) should result in findById(ticket.id)
 * throwing a NotFoundException. The ticket row and its JSONB comments
 * should no longer exist in the database.
 *
 * **Validates: Requirements 4.6**
 */

const commentArb = fc.record({
  id: fc.uuid(),
  authorType: fc.constantFrom("user", "agent"),
  authorId: fc.uuid(),
  content: fc.string(),
  createdAt: fc.date().map((d) => d.toISOString()),
});

const ticketArb = fc.record({
  id: fc.uuid(),
  spaceId: fc.uuid(),
  title: fc.string({ minLength: 1 }),
  description: fc.string(),
  status: fc.constantFrom(
    "backlog",
    "development",
    "review",
    "testing",
    "staged",
    "done",
  ),
  priority: fc.constantFrom("low", "medium", "high", "critical"),
  assigneeAgentId: fc.option(fc.uuid(), { nil: null }),
  comments: fc.array(commentArb, { minLength: 0, maxLength: 10 }),
  statusHistory: fc.constant([]),
  prUrl: fc.option(fc.webUrl(), { nil: null }),
  createdAt: fc.date(),
  updatedAt: fc.date(),
});

describe("Property 7: Backend ticket deletion removes ticket and comments", () => {
  let service: TicketsService;
  let mockRepo: any;
  let mockEventEmitter: any;
  let deletedTickets: Set<string>;

  let mockExecutionRepo: any;

  beforeEach(() => {
    deletedTickets = new Set<string>();

    mockRepo = {
      findOneBy: jest.fn(({ id }: { id: string }) => {
        if (deletedTickets.has(id)) {
          return Promise.resolve(null);
        }
        return Promise.resolve(undefined); // default, overridden per test
      }),
      remove: jest.fn((ticket: any) => {
        deletedTickets.add(ticket.id);
        return Promise.resolve(ticket);
      }),
    };
    mockExecutionRepo = {
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      })),
    };
    mockEventEmitter = {
      emit: jest.fn(),
    };
    service = new TicketsService(mockRepo, mockExecutionRepo, mockEventEmitter);
  });

  it("delete should remove ticket so findById throws NotFoundException", async () => {
    await fc.assert(
      fc.asyncProperty(ticketArb, async (ticket) => {
        // Reset state for each iteration
        deletedTickets.clear();
        mockRepo.findOneBy.mockReset();
        mockRepo.remove.mockReset();
        mockEventEmitter.emit.mockReset();

        // Before deletion: findOneBy returns the ticket
        mockRepo.findOneBy.mockImplementation(({ id }: { id: string }) => {
          if (deletedTickets.has(id)) {
            return Promise.resolve(null);
          }
          if (id === ticket.id) {
            return Promise.resolve({ ...ticket });
          }
          return Promise.resolve(null);
        });

        mockRepo.remove.mockImplementation((t: any) => {
          deletedTickets.add(t.id);
          return Promise.resolve(t);
        });

        // Delete the ticket
        await service.delete(ticket.id);

        // After deletion: findById should throw NotFoundException
        await expect(service.findById(ticket.id)).rejects.toThrow(
          NotFoundException,
        );

        // Verify remove was called with the ticket (including its comments)
        expect(mockRepo.remove).toHaveBeenCalledTimes(1);
        const removedTicket = mockRepo.remove.mock.calls[0][0];
        expect(removedTicket.id).toBe(ticket.id);
        expect(removedTicket.comments).toEqual(ticket.comments);

        // Verify ticket.deleted event was emitted
        expect(mockEventEmitter.emit).toHaveBeenCalledWith(
          "ticket.deleted",
          expect.objectContaining({ id: ticket.id }),
        );
      }),
      { numRuns: 100 },
    );
  });

  it("delete should throw NotFoundException for non-existent ticket", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (ticketId) => {
        mockRepo.findOneBy.mockResolvedValue(null);

        await expect(service.delete(ticketId)).rejects.toThrow(
          NotFoundException,
        );

        // remove should not be called
        expect(mockRepo.remove).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });
});
