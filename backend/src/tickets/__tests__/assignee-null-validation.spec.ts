import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { UpdateTicketDto } from "../dto/update-ticket.dto";

/**
 * Exploratory Tests for Ticket Update 400 Error Bug
 *
 * These tests confirm the bug exists BEFORE the fix is applied.
 * The bug: PATCH `/api/tickets/:id` returns 400 Bad Request when
 * `assigneeAgentId: null` or `assigneeUserId: null` is sent.
 *
 * The `@IsUUID()` decorator in `UpdateTicketDto` rejects `null` values,
 * even though `null` is a valid value for clearing assignments.
 *
 * **Validates: Requirements 1.1, 1.2 (Bug Condition)**
 */
describe("Exploratory: UpdateTicketDto assignee null validation bug", () => {
  describe("Bug Condition 1.1: assigneeAgentId: null causes validation error", () => {
    it("should reject assigneeAgentId: null (confirms bug exists)", async () => {
      // Arrange: Create DTO with null assigneeAgentId to clear assignment
      const input = { assigneeAgentId: null };
      const dto = plainToInstance(UpdateTicketDto, input);

      // Act: Validate the DTO
      const errors = await validate(dto, { whitelist: true });

      // Assert: Bug causes validation error on assigneeAgentId
      // This test EXPECTS to find an error (confirming the bug exists)
      const assigneeAgentIdError = errors.find(
        (e) => e.property === "assigneeAgentId",
      );
      expect(assigneeAgentIdError).toBeDefined();
      expect(assigneeAgentIdError?.constraints).toHaveProperty("isUuid");
    });
  });

  describe("Bug Condition 1.2: assigneeUserId: null causes validation error", () => {
    it("should reject assigneeUserId: null (confirms bug exists)", async () => {
      // Arrange: Create DTO with null assigneeUserId to clear assignment
      const input = { assigneeUserId: null };
      const dto = plainToInstance(UpdateTicketDto, input);

      // Act: Validate the DTO
      const errors = await validate(dto, { whitelist: true });

      // Assert: Bug causes validation error on assigneeUserId
      // This test EXPECTS to find an error (confirming the bug exists)
      const assigneeUserIdError = errors.find(
        (e) => e.property === "assigneeUserId",
      );
      expect(assigneeUserIdError).toBeDefined();
      expect(assigneeUserIdError?.constraints).toHaveProperty("isUuid");
    });
  });

  describe("Bug Condition: Both assignee fields null causes validation errors", () => {
    it("should reject both assigneeAgentId: null and assigneeUserId: null (confirms bug exists)", async () => {
      // Arrange: Create DTO with both null values to clear both assignments
      const input = { assigneeAgentId: null, assigneeUserId: null };
      const dto = plainToInstance(UpdateTicketDto, input);

      // Act: Validate the DTO
      const errors = await validate(dto, { whitelist: true });

      // Assert: Bug causes validation errors on both fields
      const assigneeAgentIdError = errors.find(
        (e) => e.property === "assigneeAgentId",
      );
      const assigneeUserIdError = errors.find(
        (e) => e.property === "assigneeUserId",
      );

      expect(assigneeAgentIdError).toBeDefined();
      expect(assigneeUserIdError).toBeDefined();
    });
  });
});
