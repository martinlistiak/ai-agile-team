import * as fc from "fast-check";
import { formatRequestLog } from "../common/structured-logger";

/**
 * Property 19: Request log contains required fields
 * Validates: Requirements 18.4
 *
 * For any HTTP request processed by the logging middleware, the structured
 * log output should contain: method, path, statusCode, and responseTime.
 */
describe("Property 19: Request log contains required fields", () => {
  const httpMethods = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
    "HEAD",
  ] as const;

  const requestLogArb = fc.record({
    method: fc.constantFrom(...httpMethods),
    path: fc.stringMatching(/^\/[a-z0-9\-\/]{0,100}$/),
    statusCode: fc.integer({ min: 100, max: 599 }),
    responseTime: fc.nat({ max: 30000 }),
  });

  it("should always contain method, path, statusCode, and responseTime", () => {
    fc.assert(
      fc.property(requestLogArb, (entry) => {
        const logOutput = formatRequestLog(entry);
        const parsed = JSON.parse(logOutput);

        expect(parsed.method).toBe(entry.method);
        expect(parsed.path).toBe(entry.path);
        expect(parsed.statusCode).toBe(entry.statusCode);
        expect(parsed.responseTime).toBe(entry.responseTime);
      }),
      { numRuns: 100 },
    );
  });

  it("should always include a valid ISO timestamp", () => {
    fc.assert(
      fc.property(requestLogArb, (entry) => {
        const logOutput = formatRequestLog(entry);
        const parsed = JSON.parse(logOutput);

        expect(parsed.timestamp).toBeDefined();
        const date = new Date(parsed.timestamp);
        expect(date.getTime()).not.toBeNaN();
      }),
      { numRuns: 100 },
    );
  });

  it("should always set level to 'info'", () => {
    fc.assert(
      fc.property(requestLogArb, (entry) => {
        const logOutput = formatRequestLog(entry);
        const parsed = JSON.parse(logOutput);

        expect(parsed.level).toBe("info");
      }),
      { numRuns: 100 },
    );
  });

  it("should always produce valid JSON output", () => {
    fc.assert(
      fc.property(requestLogArb, (entry) => {
        const logOutput = formatRequestLog(entry);
        expect(() => JSON.parse(logOutput)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });
});
