import { NotFoundException } from "@nestjs/common";
import { AccessControlService } from "../access-control.service";

describe("AccessControlService", () => {
  let service: AccessControlService;
  let spaceRepo: any;
  let ticketQb: any;
  let agentQb: any;
  let ruleQb: any;
  let suggestedRuleQb: any;
  let attachmentQb: any;
  let trainingQb: any;
  let memberQb: any;

  beforeEach(() => {
    ticketQb = buildQueryBuilder();
    agentQb = buildQueryBuilder();
    ruleQb = buildQueryBuilder();
    suggestedRuleQb = buildQueryBuilder();
    attachmentQb = buildQueryBuilder();
    trainingQb = buildQueryBuilder();
    memberQb = buildQueryBuilder();

    spaceRepo = {
      findOneBy: jest.fn(),
    };

    service = new AccessControlService(
      spaceRepo as any,
      {
        createQueryBuilder: jest.fn(() => ticketQb),
        findOneBy: jest.fn(),
      } as any,
      {
        createQueryBuilder: jest.fn(() => agentQb),
        findOneBy: jest.fn(),
      } as any,
      { createQueryBuilder: jest.fn(() => ruleQb) } as any,
      { createQueryBuilder: jest.fn(() => suggestedRuleQb) } as any,
      { createQueryBuilder: jest.fn(() => attachmentQb) } as any,
      { findOneBy: jest.fn() } as any,
      {
        createQueryBuilder: jest.fn(() => memberQb),
        findOneBy: jest.fn(),
      } as any,
      { createQueryBuilder: jest.fn(() => trainingQb) } as any,
    );
  });

  it("allows direct space owners to access a space", async () => {
    spaceRepo.findOneBy.mockResolvedValue({ id: "space-1", userId: "owner-1" });

    await expect(
      service.getAccessibleSpaceOrThrow("space-1", "owner-1"),
    ).resolves.toEqual({ id: "space-1", userId: "owner-1" });
  });

  it("allows team collaborators to access the owner's space", async () => {
    spaceRepo.findOneBy.mockResolvedValue({ id: "space-1", userId: "owner-1" });
    memberQb.getCount.mockResolvedValue(1);

    await expect(
      service.getAccessibleSpaceOrThrow("space-1", "member-1"),
    ).resolves.toEqual({ id: "space-1", userId: "owner-1" });
  });

  it("rejects unrelated users from accessing another owner's space", async () => {
    spaceRepo.findOneBy.mockResolvedValue({ id: "space-1", userId: "owner-1" });
    memberQb.getCount.mockResolvedValue(0);

    await expect(
      service.getAccessibleSpaceOrThrow("space-1", "intruder-1"),
    ).rejects.toThrow(NotFoundException);
  });

  it("allows collaborator access to a ticket through the owning space", async () => {
    ticketQb.getOne.mockResolvedValue({
      id: "ticket-1",
      space: { id: "space-1", userId: "owner-1" },
    });
    memberQb.getCount.mockResolvedValue(1);

    await expect(
      service.getAccessibleTicketOrThrow("ticket-1", "member-1"),
    ).resolves.toMatchObject({ id: "ticket-1" });
  });

  it("rejects unrelated users from accessing a ticket", async () => {
    ticketQb.getOne.mockResolvedValue({
      id: "ticket-1",
      space: { id: "space-1", userId: "owner-1" },
    });
    memberQb.getCount.mockResolvedValue(0);

    await expect(
      service.getAccessibleTicketOrThrow("ticket-1", "intruder-1"),
    ).rejects.toThrow(NotFoundException);
  });
});

function buildQueryBuilder() {
  return {
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getCount: jest.fn(),
  };
}
