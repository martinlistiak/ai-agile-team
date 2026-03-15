import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { getStatusRingClass } from "@/lib/avatars";

/**
 * Property 9: Agent status maps to correct avatar ring color
 *
 * For any agent status value ('idle', 'active', 'error'), the status ring CSS
 * class mapping function should return the correct color: gray for idle,
 * green (pulsing) for active, red for error.
 *
 * **Validates: Requirements 9.3**
 */

describe("Property 9: Agent status maps to correct avatar ring color", () => {
  it("every valid agent status maps to the correct ring CSS class", () => {
    const expectedMapping: Record<string, string> = {
      idle: "ring-2 ring-gray-400",
      active: "ring-2 ring-green-400 animate-pulse-dot",
      error: "ring-2 ring-red-500",
    };

    fc.assert(
      fc.property(
        fc.constantFrom("idle" as const, "active" as const, "error" as const),
        (status) => {
          const result = getStatusRingClass(status);
          expect(result).toBe(expectedMapping[status]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("idle status always produces a gray ring without animation", () => {
    fc.assert(
      fc.property(fc.constant("idle" as const), (status) => {
        const result = getStatusRingClass(status);
        expect(result).toContain("ring-gray-400");
        expect(result).toContain("ring-2");
        expect(result).not.toContain("animate");
      }),
      { numRuns: 100 },
    );
  });

  it("active status always produces a green pulsing ring", () => {
    fc.assert(
      fc.property(fc.constant("active" as const), (status) => {
        const result = getStatusRingClass(status);
        expect(result).toContain("ring-green-400");
        expect(result).toContain("ring-2");
        expect(result).toContain("animate-pulse-dot");
      }),
      { numRuns: 100 },
    );
  });

  it("error status always produces a red ring without animation", () => {
    fc.assert(
      fc.property(fc.constant("error" as const), (status) => {
        const result = getStatusRingClass(status);
        expect(result).toContain("ring-red-500");
        expect(result).toContain("ring-2");
        expect(result).not.toContain("animate");
      }),
      { numRuns: 100 },
    );
  });

  it("all statuses include the ring-2 base class", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("idle" as const, "active" as const, "error" as const),
        (status) => {
          const result = getStatusRingClass(status);
          expect(result).toContain("ring-2");
        },
      ),
      { numRuns: 100 },
    );
  });
});
