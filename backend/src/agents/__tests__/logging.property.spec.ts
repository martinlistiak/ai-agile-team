import * as fc from "fast-check";
import { formatAgentExecutionLog } from "../../common/structured-logger";

/**
 * Property 18: Agent execution log contains required fields
 * Validates: Requirements 18.3
 *
 * For any agent execution event (start, complete, or fail), the structured
 * log output should contain: executionId, agentType, ticketId, and duration
 * (for complete/fail events).
 */
describe("Property 18: Agent execution log contains required fields", () => {
  const agentTypes = ["developer", "tester", "pm"] as const;
  const eventTypes = ["start", "complete", "fail"] as const;

  const executionEventArb = fc.record({
    event: fc.constantFrom(...eventTypes),
    executionId: fc.uuid(),
    agentType: fc.constantFrom(...agentTypes),
    ticketId: fc.option(fc.uuid(), { nil: undefined }),
    duration: fc.option(fc.nat({ max: 600000 }), { nil: undefined }),
    error: fc.option(fc.string({ minLength: 1, maxLength: 200 }), {
      nil: undefined,
    }),
  });

  it("should always contain executionId, agentType, and event in the log output", () => {
    fc.assert(
      fc.property(executionEventArb, (event) => {
        const logOutput = formatAgentExecutionLog(event);
        const parsed = JSON.parse(logOutput);

        expect(parsed.executionId).toBe(event.executionId);
        expect(parsed.agentType).toBe(event.agentType);
        expect(parsed.message).toContain(event.event);
        expect(parsed.timestamp).toBeDefined();
        expect(typeof parsed.timestamp).toBe("string");
        expect(parsed.level).toBeDefined();
      }),
      { numRuns: 100 },
    );
  });

  it("should contain duration for complete and fail events when provided", () => {
    const completeOrFailArb = fc.record({
      event: fc.constantFrom("complete" as const, "fail" as const),
      executionId: fc.uuid(),
      agentType: fc.constantFrom(...agentTypes),
      ticketId: fc.uuid(),
      duration: fc.nat({ max: 600000 }),
    });

    fc.assert(
      fc.property(completeOrFailArb, (event) => {
        const logOutput = formatAgentExecutionLog(event);
        const parsed = JSON.parse(logOutput);

        expect(parsed.duration).toBe(event.duration);
        expect(parsed.ticketId).toBe(event.ticketId);
      }),
      { numRuns: 100 },
    );
  });

  it("should set level to 'error' for fail events and 'info' for others", () => {
    fc.assert(
      fc.property(executionEventArb, (event) => {
        const logOutput = formatAgentExecutionLog(event);
        const parsed = JSON.parse(logOutput);

        if (event.event === "fail") {
          expect(parsed.level).toBe("error");
        } else {
          expect(parsed.level).toBe("info");
        }
      }),
      { numRuns: 100 },
    );
  });

  it("should always produce valid JSON output", () => {
    fc.assert(
      fc.property(executionEventArb, (event) => {
        const logOutput = formatAgentExecutionLog(event);
        expect(() => JSON.parse(logOutput)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });
});
