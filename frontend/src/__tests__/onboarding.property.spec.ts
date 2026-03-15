import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  getNextStep,
  type WizardStep,
} from "@/features/onboarding/OnboardingWizard";

/**
 * Property 17: Onboarding wizard step advancement
 *
 * For any wizard step (1, 2, or 3), performing either "complete" or "skip"
 * should advance the wizard to the next step. Skipping step 2 (GitHub connection)
 * should not block progression to step 3.
 *
 * **Validates: Requirements 16.5**
 */

describe("Property 17: Onboarding wizard step advancement", () => {
  it("completing or skipping a non-final step advances to the next step", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1 as WizardStep, 2 as WizardStep),
        fc.constantFrom("complete" as const, "skip" as const),
        (step, action) => {
          const next = getNextStep(step, action);
          expect(next).toBe(step + 1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("completing step 3 finishes the wizard (returns null)", () => {
    fc.assert(
      fc.property(fc.constant(3 as WizardStep), (step) => {
        const next = getNextStep(step, "complete");
        expect(next).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("skipping step 2 advances to step 3 (GitHub is not blocking)", () => {
    fc.assert(
      fc.property(fc.constant(2 as WizardStep), (step) => {
        const next = getNextStep(step, "skip");
        expect(next).toBe(3);
      }),
      { numRuns: 100 },
    );
  });

  it("any action on any step produces either the next step or null (wizard end)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1 as WizardStep, 2 as WizardStep, 3 as WizardStep),
        fc.boolean(),
        (step, shouldSkip) => {
          const action = shouldSkip ? "skip" : "complete";
          const next = getNextStep(step, action);
          if (step < 3) {
            expect(next).toBe(step + 1);
          } else {
            expect(next).toBeNull();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("step advancement is monotonically increasing until completion", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(1 as WizardStep, 2 as WizardStep, 3 as WizardStep),
        fc.constantFrom("complete" as const, "skip" as const),
        (step, action) => {
          const next = getNextStep(step, action);
          if (next !== null) {
            expect(next).toBeGreaterThan(step);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
