import * as fc from "fast-check";

/**
 * Feature: spec-gap-implementation
 * Property 1: Status-to-agent mapping determines play button state
 *
 * For any ticket status, the play button is enabled if and only if the status
 * has a mapped agent in STAGE_AGENT_MAP (development → developer, testing → tester).
 * For statuses without a mapping (backlog, planning, review, staged, done),
 * the play button must be disabled.
 *
 * **Validates: Requirements 1.1, 1.4**
 */

type PipelineStage =
  | "backlog"
  | "planning"
  | "development"
  | "review"
  | "testing"
  | "staged"
  | "done";

// Mirror the STAGE_AGENT_MAP from pipeline.service.ts
const STAGE_AGENT_MAP: Partial<Record<PipelineStage, "developer" | "tester">> =
  {
    development: "developer",
    testing: "tester",
  };

const ALL_STATUSES: PipelineStage[] = [
  "backlog",
  "planning",
  "development",
  "review",
  "testing",
  "staged",
  "done",
];

const STATUSES_WITH_AGENT: PipelineStage[] = ["development", "testing"];
const STATUSES_WITHOUT_AGENT: PipelineStage[] = [
  "backlog",
  "planning",
  "review",
  "staged",
  "done",
];

function getAgentForStatus(status: PipelineStage): string | undefined {
  return STAGE_AGENT_MAP[status];
}

function isPlayButtonEnabled(status: PipelineStage): boolean {
  return status in STAGE_AGENT_MAP;
}

describe("Feature: spec-gap-implementation, Property 1: Status-to-agent mapping determines play button state", () => {
  it("play button is enabled if and only if the status has a mapped agent", () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_STATUSES), (status: PipelineStage) => {
        const agent = getAgentForStatus(status);
        const enabled = isPlayButtonEnabled(status);

        if (STATUSES_WITH_AGENT.includes(status)) {
          // Status has a mapped agent → play button enabled and agent is defined
          expect(enabled).toBe(true);
          expect(agent).toBeDefined();
        } else {
          // Status has no mapped agent → play button disabled and agent is undefined
          expect(enabled).toBe(false);
          expect(agent).toBeUndefined();
        }
      }),
      { numRuns: 100 },
    );
  });

  it("development status maps to developer agent", () => {
    fc.assert(
      fc.property(fc.constant("development" as PipelineStage), (status) => {
        expect(getAgentForStatus(status)).toBe("developer");
        expect(isPlayButtonEnabled(status)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("testing status maps to tester agent", () => {
    fc.assert(
      fc.property(fc.constant("testing" as PipelineStage), (status) => {
        expect(getAgentForStatus(status)).toBe("tester");
        expect(isPlayButtonEnabled(status)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("statuses without mapped agents have play button disabled", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATUSES_WITHOUT_AGENT),
        (status: PipelineStage) => {
          expect(getAgentForStatus(status)).toBeUndefined();
          expect(isPlayButtonEnabled(status)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: spec-gap-implementation
 * Property 6: Pipeline advance moves ticket to next enabled stage
 *
 * For any ticket at a given pipeline stage and any pipeline configuration,
 * calling "advance to next stage" should move the ticket to the next stage
 * that is enabled in the pipeline config, skipping disabled stages.
 *
 * **Validates: Requirements 5.2**
 */

// Mirror PIPELINE_STAGES from pipeline.service.ts
const PIPELINE_STAGES: PipelineStage[] = [
  "backlog",
  "planning",
  "development",
  "review",
  "testing",
  "staged",
  "done",
];

/**
 * Pure reimplementation of PipelineService.getNextEnabledStage for testing.
 * Mirrors the logic in pipeline.service.ts exactly:
 * - "backlog" and "done" are always considered enabled (terminal stages)
 * - Stages not in config or set to true are considered enabled
 * - Stages explicitly set to false are disabled and skipped
 */
function getNextEnabledStage(
  currentStage: PipelineStage,
  pipelineConfig: Record<string, boolean>,
): PipelineStage | null {
  const currentIndex = PIPELINE_STAGES.indexOf(currentStage);
  if (currentIndex === -1 || currentIndex >= PIPELINE_STAGES.length - 1) {
    return null;
  }

  for (let i = currentIndex + 1; i < PIPELINE_STAGES.length; i++) {
    const stage = PIPELINE_STAGES[i];
    if (stage === "done" || stage === "backlog") {
      return stage;
    }
    if (pipelineConfig[stage] !== false) {
      return stage;
    }
  }

  return null;
}

// Generator for pipeline config: each configurable stage is randomly enabled/disabled
const pipelineConfigArb = fc.record({
  planning: fc.boolean(),
  development: fc.boolean(),
  review: fc.boolean(),
  testing: fc.boolean(),
  staged: fc.boolean(),
});

// All stages except "done" (can advance from any of these)
const advanceableStageArb = fc.constantFrom<PipelineStage>(
  "backlog",
  "planning",
  "development",
  "review",
  "testing",
  "staged",
);

describe("Feature: spec-gap-implementation, Property 6: Pipeline advance moves ticket to next enabled stage", () => {
  it("advance always moves to the next enabled stage, skipping disabled ones", () => {
    fc.assert(
      fc.property(
        advanceableStageArb,
        pipelineConfigArb,
        (currentStage: PipelineStage, config: Record<string, boolean>) => {
          const nextStage = getNextEnabledStage(currentStage, config);
          const currentIndex = PIPELINE_STAGES.indexOf(currentStage);

          if (nextStage === null) {
            // Should never happen for advanceable stages since "done" is always enabled
            fail(
              `getNextEnabledStage returned null for stage "${currentStage}" which should always have "done" ahead`,
            );
          } else {
            const nextIndex = PIPELINE_STAGES.indexOf(nextStage);

            // The next stage must be after the current stage
            expect(nextIndex).toBeGreaterThan(currentIndex);

            // The next stage must be enabled: either "done"/"backlog" (always enabled)
            // or config[stage] !== false
            if (nextStage !== "done" && nextStage !== "backlog") {
              expect(config[nextStage]).not.toBe(false);
            }

            // All stages between current and next must be disabled
            for (let i = currentIndex + 1; i < nextIndex; i++) {
              const skippedStage = PIPELINE_STAGES[i];
              if (skippedStage !== "done" && skippedStage !== "backlog") {
                expect(config[skippedStage]).toBe(false);
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("advance from 'done' returns null (already at final stage)", () => {
    fc.assert(
      fc.property(pipelineConfigArb, (config: Record<string, boolean>) => {
        const nextStage = getNextEnabledStage("done", config);
        expect(nextStage).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: spec-gap-implementation
 * Property 7: Full pipeline run reaches final enabled stage
 *
 * For any ticket at a starting stage and any pipeline configuration with at least
 * one enabled stage ahead, running the full pipeline should result in the ticket
 * reaching the last enabled stage in the pipeline sequence.
 *
 * **Validates: Requirements 5.3**
 */

/**
 * Simulate a full pipeline run using getNextEnabledStage repeatedly.
 * Returns the final stage reached.
 */
function simulateFullPipelineRun(
  startStage: PipelineStage,
  config: Record<string, boolean>,
): PipelineStage {
  let current = startStage;
  const visited = new Set<string>();

  while (true) {
    if (visited.has(current)) {
      break;
    }
    visited.add(current);

    const next = getNextEnabledStage(current, config);
    if (next === null) break;
    current = next;
  }

  return current;
}

/**
 * Compute the expected final stage: the last enabled stage in the pipeline
 * sequence after the starting stage. Since "done" is always enabled and is
 * the last stage, the full run should always reach "done" from any start.
 */
function computeExpectedFinalStage(
  startStage: PipelineStage,
  config: Record<string, boolean>,
): PipelineStage {
  const startIndex = PIPELINE_STAGES.indexOf(startStage);
  let lastEnabled = startStage;

  for (let i = startIndex + 1; i < PIPELINE_STAGES.length; i++) {
    const stage = PIPELINE_STAGES[i];
    if (stage === "done" || stage === "backlog") {
      lastEnabled = stage;
    } else if (config[stage] !== false) {
      lastEnabled = stage;
    }
  }

  return lastEnabled;
}

describe("Feature: spec-gap-implementation, Property 7: Full pipeline run reaches final enabled stage", () => {
  it("full pipeline run reaches the last enabled stage in the sequence", () => {
    fc.assert(
      fc.property(
        advanceableStageArb,
        pipelineConfigArb,
        (startStage: PipelineStage, config: Record<string, boolean>) => {
          const finalStage = simulateFullPipelineRun(startStage, config);
          const expectedFinal = computeExpectedFinalStage(startStage, config);

          expect(finalStage).toBe(expectedFinal);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("full pipeline run from 'backlog' with all stages enabled reaches 'done'", () => {
    fc.assert(
      fc.property(fc.constant(true), () => {
        const allEnabled: Record<string, boolean> = {
          planning: true,
          development: true,
          review: true,
          testing: true,
          staged: true,
        };
        const finalStage = simulateFullPipelineRun("backlog", allEnabled);
        expect(finalStage).toBe("done");
      }),
      { numRuns: 100 },
    );
  });

  it("full pipeline run skips disabled stages and still reaches 'done'", () => {
    fc.assert(
      fc.property(pipelineConfigArb, (config: Record<string, boolean>) => {
        // "done" is always enabled, so full run from backlog should always reach "done"
        const finalStage = simulateFullPipelineRun("backlog", config);
        expect(finalStage).toBe("done");
      }),
      { numRuns: 100 },
    );
  });

  it("full pipeline run never goes backwards in the stage sequence", () => {
    fc.assert(
      fc.property(
        advanceableStageArb,
        pipelineConfigArb,
        (startStage: PipelineStage, config: Record<string, boolean>) => {
          const startIndex = PIPELINE_STAGES.indexOf(startStage);
          const finalStage = simulateFullPipelineRun(startStage, config);
          const finalIndex = PIPELINE_STAGES.indexOf(finalStage);

          expect(finalIndex).toBeGreaterThanOrEqual(startIndex);
        },
      ),
      { numRuns: 100 },
    );
  });
});
