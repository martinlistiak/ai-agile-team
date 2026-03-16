import { AgentsService } from "../agents.service";
import { Repository } from "typeorm";
import { Agent } from "../../entities/agent.entity";
import { Execution } from "../../entities/execution.entity";
import { ExecutionRegistry } from "../execution-registry";
import { EventsGateway } from "../../chat/events.gateway";

describe("AgentsService.getExecutionsByAgent", () => {
  let service: AgentsService;
  let findAndCountMock: jest.Mock;

  beforeEach(() => {
    findAndCountMock = jest.fn();
    const executionRepo = {
      findAndCount: findAndCountMock,
    } as unknown as Repository<Execution>;
    const agentRepo = {} as Repository<Agent>;
    const registry = {} as ExecutionRegistry;
    const gateway = {} as EventsGateway;
    service = new AgentsService(agentRepo, executionRepo, registry, gateway);
  });

  it("should return paginated executions ordered by startTime DESC", async () => {
    const mockExecutions = [
      {
        id: "e1",
        agentId: "a1",
        startTime: new Date("2024-01-02"),
        status: "completed",
        actionLog: [],
      },
      {
        id: "e2",
        agentId: "a1",
        startTime: new Date("2024-01-01"),
        status: "running",
        actionLog: [],
      },
    ];
    findAndCountMock.mockResolvedValue([mockExecutions, 5]);

    const result = await service.getExecutionsByAgent("a1", 1, 2);

    expect(result).toEqual({ data: mockExecutions, total: 5, page: 1 });
    expect(findAndCountMock).toHaveBeenCalledWith({
      where: { agentId: "a1" },
      order: { startTime: "DESC" },
      skip: 0,
      take: 2,
    });
  });

  it("should calculate correct skip for page 2", async () => {
    findAndCountMock.mockResolvedValue([[], 0]);

    await service.getExecutionsByAgent("a1", 2, 10);

    expect(findAndCountMock).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it("should calculate correct skip for page 3 with limit 5", async () => {
    findAndCountMock.mockResolvedValue([[], 0]);

    await service.getExecutionsByAgent("a1", 3, 5);

    expect(findAndCountMock).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 }),
    );
  });
});
