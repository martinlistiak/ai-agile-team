import * as fc from "fast-check";
import { AgentsService } from "../agents.service";
import { Repository } from "typeorm";
import { Agent } from "../../entities/agent.entity";
import { Execution } from "../../entities/execution.entity";

/**
 * Feature: spec-gap-implementation
 * Property 4: Execution history is chronologically ordered with required fields
 *
 * For any agent with one or more executions, the GET /agents/:agentId/executions
 * endpoint should return entries ordered by startTime descending, and each entry
 * must contain: id, startTime, status, and actionLog.
 *
 * **Validates: Requirements 4.2**
 *
 * Property 5: Execution pagination returns correct page sizes
 *
 * For any agent with N executions and any valid page/limit parameters, the paginated
 * response should contain at most `limit` items, the `total` should equal N, and
 * the `page` should match the requested page number.
 *
 * **Validates: Requirements 4.4**
 */

// Generator for a single execution record
const validDate = fc
  .date({
    min: new Date("2020-01-01T00:00:00.000Z"),
    max: new Date("2030-01-01T00:00:00.000Z"),
  })
  .filter((d) => !isNaN(d.getTime()));

const executionArb = fc.record({
  id: fc.uuid(),
  agentId: fc.constant("agent-1"),
  startTime: validDate,
  status: fc.constantFrom("running", "completed", "failed"),
  actionLog: fc.array(
    fc.record({
      tool: fc.string({ minLength: 1, maxLength: 20 }),
      input: fc.string({ minLength: 0, maxLength: 50 }),
      timestamp: validDate.map((d) => d.toISOString()),
    }),
    { minLength: 0, maxLength: 5 },
  ),
});

describe("Feature: spec-gap-implementation, Property 4: Execution history is chronologically ordered with required fields", () => {
  let service: AgentsService;
  let findAndCountMock: jest.Mock;

  beforeEach(() => {
    findAndCountMock = jest.fn();
    const executionRepo = {
      findAndCount: findAndCountMock,
    } as unknown as Repository<Execution>;
    const agentRepo = {} as Repository<Agent>;
    service = new AgentsService(agentRepo, executionRepo);
  });

  it("returned executions are ordered by startTime DESC and contain required fields", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(executionArb, { minLength: 1, maxLength: 20 }),
        async (executions) => {
          // Sort descending by startTime to simulate DB ordering
          const sorted = [...executions].sort(
            (a, b) => b.startTime.getTime() - a.startTime.getTime(),
          );

          findAndCountMock.mockResolvedValue([sorted, executions.length]);

          const result = await service.getExecutionsByAgent("agent-1", 1, 100);
          const { data } = result;

          // Verify chronological DESC ordering
          for (let i = 1; i < data.length; i++) {
            expect(
              new Date(data[i - 1].startTime).getTime(),
            ).toBeGreaterThanOrEqual(new Date(data[i].startTime).getTime());
          }

          // Verify each entry has required fields
          for (const entry of data) {
            expect(entry).toHaveProperty("id");
            expect(entry).toHaveProperty("startTime");
            expect(entry).toHaveProperty("status");
            expect(entry).toHaveProperty("actionLog");
            expect(typeof entry.id).toBe("string");
            expect(entry.startTime).toBeInstanceOf(Date);
            expect(typeof entry.status).toBe("string");
            expect(Array.isArray(entry.actionLog)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("findAndCount is called with startTime DESC ordering", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(executionArb, { minLength: 0, maxLength: 10 }),
        async (executions) => {
          findAndCountMock.mockResolvedValue([executions, executions.length]);

          await service.getExecutionsByAgent("agent-1", 1, 20);

          expect(findAndCountMock).toHaveBeenCalledWith(
            expect.objectContaining({
              order: { startTime: "DESC" },
            }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Feature: spec-gap-implementation, Property 5: Execution pagination returns correct page sizes", () => {
  let service: AgentsService;
  let findAndCountMock: jest.Mock;

  beforeEach(() => {
    findAndCountMock = jest.fn();
    const executionRepo = {
      findAndCount: findAndCountMock,
    } as unknown as Repository<Execution>;
    const agentRepo = {} as Repository<Agent>;
    service = new AgentsService(agentRepo, executionRepo);
  });

  it("response contains at most `limit` items, correct total, and correct page", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(executionArb, { minLength: 0, maxLength: 50 }),
        fc.integer({ min: 1, max: 10 }), // page
        fc.integer({ min: 1, max: 20 }), // limit
        async (allExecutions, page, limit) => {
          const totalCount = allExecutions.length;
          const skip = (page - 1) * limit;
          // Simulate what the DB would return for this page
          const pageData = allExecutions.slice(skip, skip + limit);

          findAndCountMock.mockResolvedValue([pageData, totalCount]);

          const result = await service.getExecutionsByAgent(
            "agent-1",
            page,
            limit,
          );

          // Response should contain at most `limit` items
          expect(result.data.length).toBeLessThanOrEqual(limit);

          // Total should equal the full count
          expect(result.total).toBe(totalCount);

          // Page should match the requested page
          expect(result.page).toBe(page);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("skip is calculated as (page - 1) * limit", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // page
        fc.integer({ min: 1, max: 50 }), // limit
        async (page, limit) => {
          findAndCountMock.mockResolvedValue([[], 0]);

          await service.getExecutionsByAgent("agent-1", page, limit);

          const expectedSkip = (page - 1) * limit;
          expect(findAndCountMock).toHaveBeenCalledWith(
            expect.objectContaining({
              skip: expectedSkip,
              take: limit,
            }),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
