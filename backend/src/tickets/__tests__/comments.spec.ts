import { TicketsService } from "../tickets.service";
import { NotFoundException } from "@nestjs/common";

describe("TicketsService.addComment", () => {
  let service: TicketsService;
  let mockRepo: any;
  let mockEventEmitter: any;

  beforeEach(() => {
    mockRepo = {
      findOneBy: jest.fn(),
      save: jest.fn((ticket: any) => Promise.resolve(ticket)),
    };
    mockEventEmitter = {
      emit: jest.fn(),
    };
    service = new TicketsService(
      mockRepo,
      {} as any,
      {} as any,
      mockEventEmitter,
    );
  });

  it("should append a comment with correct shape to the ticket", async () => {
    const existingTicket = {
      id: "ticket-1",
      comments: [],
    };
    mockRepo.findOneBy.mockResolvedValue(existingTicket);

    const result = await service.addComment(
      "ticket-1",
      "Hello world",
      "user",
      "user-123",
    );

    expect(result.comments).toHaveLength(1);
    const comment = result.comments[0];
    expect(comment).toMatchObject({
      authorType: "user",
      authorId: "user-123",
      content: "Hello world",
    });
    expect(comment.id).toBeDefined();
    expect(comment.createdAt).toBeDefined();
  });

  it("should append to existing comments without overwriting", async () => {
    const existingComment = {
      id: "old-comment",
      authorType: "agent",
      authorId: "agent-1",
      content: "Previous comment",
      createdAt: "2024-01-01T00:00:00.000Z",
    };
    const existingTicket = {
      id: "ticket-1",
      comments: [existingComment],
    };
    mockRepo.findOneBy.mockResolvedValue(existingTicket);

    const result = await service.addComment(
      "ticket-1",
      "New comment",
      "user",
      "user-456",
    );

    expect(result.comments).toHaveLength(2);
    expect(result.comments[0]).toEqual(existingComment);
    expect(result.comments[1].content).toBe("New comment");
  });

  it("should throw NotFoundException for non-existent ticket", async () => {
    mockRepo.findOneBy.mockResolvedValue(null);

    await expect(
      service.addComment("nonexistent", "content", "user", "user-1"),
    ).rejects.toThrow(NotFoundException);
  });

  it("should emit ticket.commented event", async () => {
    mockRepo.findOneBy.mockResolvedValue({
      id: "ticket-1",
      title: "Ticket 1",
      spaceId: "space-1",
      comments: [],
    });

    await service.addComment("ticket-1", "content", "user", "user-1");

    expect(mockEventEmitter.emit).toHaveBeenCalledWith(
      "ticket.commented",
      expect.objectContaining({
        ticketId: "ticket-1",
        ticketTitle: "Ticket 1",
        spaceId: "space-1",
        commenterId: "user-1",
      }),
    );
  });

  it("should handle null comments array gracefully", async () => {
    mockRepo.findOneBy.mockResolvedValue({
      id: "ticket-1",
      comments: null,
    });

    const result = await service.addComment(
      "ticket-1",
      "First comment",
      "user",
      "user-1",
    );

    expect(result.comments).toHaveLength(1);
    expect(result.comments[0].content).toBe("First comment");
  });
});
