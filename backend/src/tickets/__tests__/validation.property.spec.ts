import * as fc from "fast-check";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { CreateTicketDto } from "../dto/create-ticket.dto";
import { UpdateTicketDto } from "../dto/update-ticket.dto";
import { MoveTicketDto } from "../dto/move-ticket.dto";

/**
 * Property 14: DTO validation rejects invalid input with HTTP 400
 *
 * For any POST/PATCH endpoint and any request body that violates the DTO
 * constraints (missing required fields, wrong types, invalid enum values),
 * the validation should produce errors.
 *
 * **Validates: Requirements 13.1, 13.2**
 */
describe("Property 14: DTO validation rejects invalid input", () => {
  const validStatuses = [
    "backlog",
    "planning",
    "development",
    "review",
    "testing",
    "staged",
    "done",
  ];
  const validPriorities = ["low", "medium", "high", "critical"];

  it("CreateTicketDto rejects missing or empty title", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("", undefined, null),
        async (badTitle) => {
          const dto = plainToInstance(CreateTicketDto, { title: badTitle });
          const errors = await validate(dto, {
            whitelist: true,
          });
          expect(errors.length).toBeGreaterThan(0);
          const titleError = errors.find((e) => e.property === "title");
          expect(titleError).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("CreateTicketDto rejects invalid priority enum values", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => !validPriorities.includes(s)),
        async (badPriority) => {
          const dto = plainToInstance(CreateTicketDto, {
            title: "Valid Title",
            priority: badPriority,
          });
          const errors = await validate(dto, { whitelist: true });
          const priorityError = errors.find((e) => e.property === "priority");
          expect(priorityError).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("CreateTicketDto rejects invalid status enum values", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => !validStatuses.includes(s)),
        async (badStatus) => {
          const dto = plainToInstance(CreateTicketDto, {
            title: "Valid Title",
            status: badStatus,
          });
          const errors = await validate(dto, { whitelist: true });
          const statusError = errors.find((e) => e.property === "status");
          expect(statusError).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("CreateTicketDto accepts valid input without errors", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1 }),
          priority: fc.constantFrom(...validPriorities),
          status: fc.constantFrom(...validStatuses),
        }),
        async (input) => {
          const dto = plainToInstance(CreateTicketDto, input);
          const errors = await validate(dto, { whitelist: true });
          expect(errors.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("MoveTicketDto rejects invalid status values", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => !validStatuses.includes(s)),
        async (badStatus) => {
          const dto = plainToInstance(MoveTicketDto, { status: badStatus });
          const errors = await validate(dto, { whitelist: true });
          expect(errors.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("UpdateTicketDto rejects invalid priority enum values", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => !validPriorities.includes(s)),
        async (badPriority) => {
          const dto = plainToInstance(UpdateTicketDto, {
            priority: badPriority,
          });
          const errors = await validate(dto, { whitelist: true });
          const priorityError = errors.find((e) => e.property === "priority");
          expect(priorityError).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("UpdateTicketDto strips unknown properties with whitelist", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          title: fc.string({ minLength: 1 }),
          unknownField: fc.string(),
        }),
        async (input) => {
          const dto = plainToInstance(UpdateTicketDto, input);
          const errors = await validate(dto, {
            whitelist: true,
            forbidNonWhitelisted: true,
          });
          // forbidNonWhitelisted should flag the unknown property
          const unknownError = errors.find(
            (e) => e.property === "unknownField",
          );
          expect(unknownError).toBeDefined();
        },
      ),
      { numRuns: 100 },
    );
  });
});
