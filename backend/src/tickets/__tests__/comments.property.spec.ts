import * as fc from "fast-check";
import { TicketsService } from "../tickets.service";

/**
 * Property 3: Comment persistence round-trip
 *
 * For any comment with valid Markdown content, saving it via the comment API
 * and then fetching the ticket should return a comment with the same Markdown
 * content string.
 *
 * **Validates: Requirements 3.4**
 */
describe("Property 3: Comment persistence round-trip", () => {
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

  it("should preserve comment content through save and retrieval", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), async (content) => {
        const existingTicket = {
          id: "ticket-1",
          comments: [],
        };
        mockRepo.findOneBy.mockResolvedValue(existingTicket);

        const saved = await service.addComment(
          "ticket-1",
          content,
          "user",
          "user-123",
        );

        // The last comment in the array should have the exact content we provided
        const lastComment = saved.comments[saved.comments.length - 1];
        expect(lastComment.content).toBe(content);
      }),
      { numRuns: 100 },
    );
  });

  it("should preserve content when appending to existing comments", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(),
        fc.string(),
        async (firstContent, secondContent) => {
          // First comment
          const ticket = {
            id: "ticket-1",
            comments: [] as any[],
          };
          mockRepo.findOneBy.mockResolvedValue(ticket);

          const afterFirst = await service.addComment(
            "ticket-1",
            firstContent,
            "user",
            "user-1",
          );

          // Set up for second comment with the updated ticket
          mockRepo.findOneBy.mockResolvedValue({
            ...afterFirst,
            comments: [...afterFirst.comments],
          });

          const afterSecond = await service.addComment(
            "ticket-1",
            secondContent,
            "agent",
            "agent-1",
          );

          // Both comments should retain their original content
          expect(afterSecond.comments[0].content).toBe(firstContent);
          expect(afterSecond.comments[1].content).toBe(secondContent);
        },
      ),
      { numRuns: 100 },
    );
  });
});
