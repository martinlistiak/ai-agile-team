# Ticket Update 400 Error Bugfix Design

## Overview

The PATCH `/api/tickets/:id` endpoint incorrectly returns HTTP 400 Bad Request when attempting to clear ticket assignments by setting `assigneeAgentId` or `assigneeUserId` to `null`. The root cause is that the `@IsUUID()` decorator in `UpdateTicketDto` rejects `null` values, even though `null` is a valid value for clearing assignments. The fix involves using `@ValidateIf()` to conditionally apply UUID validation only when the value is not `null`.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when `assigneeAgentId` or `assigneeUserId` is explicitly set to `null` in a PATCH request
- **Property (P)**: The desired behavior - `null` values should be accepted and used to clear the assignment in the database
- **Preservation**: Existing UUID validation for non-null values must remain unchanged
- **UpdateTicketDto**: The DTO class in `backend/src/tickets/dto/update-ticket.dto.ts` that validates PATCH request bodies
- **@IsUUID()**: class-validator decorator that validates a string is a valid UUID format
- **@ValidateIf()**: class-validator decorator that conditionally applies validation based on a predicate

## Bug Details

### Bug Condition

The bug manifests when a PATCH request to `/api/tickets/:id` includes `assigneeAgentId: null` or `assigneeUserId: null` to clear the assignment. The `@IsUUID()` decorator rejects `null` because it expects a valid UUID string, causing the validation pipeline to return HTTP 400.

**Formal Specification:**

```
FUNCTION isBugCondition(input)
  INPUT: input of type UpdateTicketDto (PATCH request body)
  OUTPUT: boolean

  RETURN (input.assigneeAgentId === null)
         OR (input.assigneeUserId === null)
END FUNCTION
```

### Examples

- `PATCH /api/tickets/:id` with `{ "assigneeAgentId": null }` → Expected: 200 OK, Actual: 400 Bad Request
- `PATCH /api/tickets/:id` with `{ "assigneeUserId": null }` → Expected: 200 OK, Actual: 400 Bad Request
- `PATCH /api/tickets/:id` with `{ "assigneeAgentId": null, "title": "New Title" }` → Expected: 200 OK, Actual: 400 Bad Request
- `PATCH /api/tickets/:id` with `{ "assigneeAgentId": "valid-uuid" }` → Expected: 200 OK, Actual: 200 OK (works correctly)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- Valid UUID strings for `assigneeAgentId` must continue to be validated as UUIDs
- Valid UUID strings for `assigneeUserId` must continue to be validated as UUIDs
- Invalid non-null, non-UUID strings must continue to be rejected with HTTP 400
- Omitting `assigneeAgentId` or `assigneeUserId` entirely must leave existing assignments unchanged
- All other `UpdateTicketDto` fields (title, description, priority, startWorking) must continue to work as before

**Scope:**
All inputs that do NOT involve setting `assigneeAgentId` or `assigneeUserId` to `null` should be completely unaffected by this fix. This includes:

- PATCH requests with valid UUID values for assignee fields
- PATCH requests that omit assignee fields entirely
- PATCH requests that only update other fields (title, description, priority)

## Hypothesized Root Cause

Based on the bug description, the root cause is:

1. **Incorrect Decorator Configuration**: The `@IsUUID()` decorator is applied unconditionally to `assigneeAgentId` and `assigneeUserId` fields. When `null` is passed, `@IsUUID()` fails validation because `null` is not a valid UUID string.

2. **Missing Conditional Validation**: The `@IsOptional()` decorator only makes the field optional (allows `undefined`), but does not allow `null` to bypass UUID validation. The fix requires `@ValidateIf()` to skip UUID validation when the value is `null`.

## Correctness Properties

Property 1: Bug Condition - Null Values Accepted for Assignment Clearing

_For any_ PATCH request to `/api/tickets/:id` where `assigneeAgentId` is `null` or `assigneeUserId` is `null`, the fixed `UpdateTicketDto` validation SHALL accept the request without validation errors, allowing the assignment to be cleared.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - UUID Validation for Non-Null Values

_For any_ PATCH request to `/api/tickets/:id` where `assigneeAgentId` or `assigneeUserId` is a non-null, non-UUID string, the fixed `UpdateTicketDto` validation SHALL reject the request with a validation error, preserving the existing UUID validation behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

Property 3: Preservation - Valid UUID Values Accepted

_For any_ PATCH request to `/api/tickets/:id` where `assigneeAgentId` or `assigneeUserId` is a valid UUID string, the fixed `UpdateTicketDto` validation SHALL accept the request without validation errors, preserving the existing behavior.

**Validates: Requirements 3.1, 3.2**

Property 4: Preservation - Omitted Fields Unchanged

_For any_ PATCH request to `/api/tickets/:id` where `assigneeAgentId` or `assigneeUserId` is omitted (undefined), the fixed `UpdateTicketDto` validation SHALL accept the request and leave existing assignments unchanged, preserving the existing behavior.

**Validates: Requirements 3.5**

## Fix Implementation

### Changes Required

**File**: `backend/src/tickets/dto/update-ticket.dto.ts`

**Specific Changes**:

1. **Import ValidateIf**: Add `ValidateIf` to the imports from `class-validator`

2. **Add Conditional Validation for assigneeAgentId**: Add `@ValidateIf((o) => o.assigneeAgentId !== null)` before `@IsUUID()` to skip UUID validation when value is `null`

3. **Add Conditional Validation for assigneeUserId**: Add `@ValidateIf((o) => o.assigneeUserId !== null)` before `@IsUUID()` to skip UUID validation when value is `null`

4. **Update ApiPropertyOptional**: Add `nullable: true` to the Swagger documentation for both fields

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm the root cause analysis.

**Test Plan**: Write tests that validate `UpdateTicketDto` with `null` values for assignee fields. Run these tests on the UNFIXED code to observe validation failures.

**Test Cases**:

1. **Null assigneeAgentId Test**: Validate DTO with `{ assigneeAgentId: null }` (will fail on unfixed code)
2. **Null assigneeUserId Test**: Validate DTO with `{ assigneeUserId: null }` (will fail on unfixed code)
3. **Both Null Test**: Validate DTO with `{ assigneeAgentId: null, assigneeUserId: null }` (will fail on unfixed code)

**Expected Counterexamples**:

- Validation errors on `assigneeAgentId` and `assigneeUserId` properties when value is `null`
- Error message indicates UUID validation failure

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed DTO accepts the request.

**Pseudocode:**

```
FOR ALL input WHERE isBugCondition(input) DO
  dto := plainToInstance(UpdateTicketDto, input)
  errors := validate(dto)
  ASSERT errors.length = 0 for assignee fields
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed DTO produces the same validation result as the original.

**Pseudocode:**

```
FOR ALL input WHERE NOT isBugCondition(input) DO
  dto := plainToInstance(UpdateTicketDto, input)
  errors := validate(dto)
  IF input.assigneeAgentId is invalid non-null string THEN
    ASSERT errors contains assigneeAgentId error
  IF input.assigneeUserId is invalid non-null string THEN
    ASSERT errors contains assigneeUserId error
  IF input.assigneeAgentId is valid UUID or undefined THEN
    ASSERT no assigneeAgentId error
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:

- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

### Unit Tests

- Test `UpdateTicketDto` validation accepts `null` for `assigneeAgentId`
- Test `UpdateTicketDto` validation accepts `null` for `assigneeUserId`
- Test `UpdateTicketDto` validation rejects invalid non-null strings for assignee fields
- Test `UpdateTicketDto` validation accepts valid UUIDs for assignee fields
- Test `UpdateTicketDto` validation accepts omitted assignee fields

### Property-Based Tests

- Generate random valid UUIDs and verify they pass validation
- Generate random invalid non-null strings and verify they fail validation
- Generate random combinations of null, undefined, valid UUID, and invalid strings to verify correct behavior

### Integration Tests

- Test full PATCH endpoint with `null` assignee values clears assignments in database
- Test full PATCH endpoint with valid UUID assignee values updates assignments correctly
