# Ticket Update 400 Error Bugfix Tasks

## Task 1: Write Exploratory Tests to Confirm Bug

- [-] 1.1 Create test file `backend/src/tickets/__tests__/assignee-null-validation.spec.ts`
- [ ] 1.2 Write test that validates UpdateTicketDto rejects `assigneeAgentId: null` (confirms bug exists)
- [ ] 1.3 Write test that validates UpdateTicketDto rejects `assigneeUserId: null` (confirms bug exists)
- [ ] 1.4 Run exploratory tests to confirm bug behavior before fix

## Task 2: Implement the Fix

- [ ] 2.1 Add `ValidateIf` import to `backend/src/tickets/dto/update-ticket.dto.ts`
- [ ] 2.2 Add `@ValidateIf((o) => o.assigneeAgentId !== null)` decorator before `@IsUUID()` for `assigneeAgentId`
- [ ] 2.3 Add `@ValidateIf((o) => o.assigneeUserId !== null)` decorator before `@IsUUID()` for `assigneeUserId`
- [ ] 2.4 Update `@ApiPropertyOptional` to include `nullable: true` for both fields

## Task 3: Write Fix Verification Tests

- [ ] 3.1 Update exploratory tests to verify fix - `assigneeAgentId: null` should now pass validation
- [ ] 3.2 Update exploratory tests to verify fix - `assigneeUserId: null` should now pass validation

## Task 4: Write Preservation Tests (Property-Based)

- [ ] 4.1 Write property test: valid UUIDs for `assigneeAgentId` continue to pass validation
- [ ] 4.2 Write property test: valid UUIDs for `assigneeUserId` continue to pass validation
- [ ] 4.3 Write property test: invalid non-null strings for `assigneeAgentId` continue to fail validation
- [ ] 4.4 Write property test: invalid non-null strings for `assigneeUserId` continue to fail validation
- [ ] 4.5 Write property test: omitted assignee fields (undefined) continue to pass validation

## Task 5: Run All Tests and Verify

- [ ] 5.1 Run all ticket validation tests to ensure fix works and preserves existing behavior
- [ ] 5.2 Run full test suite to check for regressions
