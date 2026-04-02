# Bugfix Requirements Document

## Introduction

The PATCH `/api/tickets/:id` endpoint returns a 400 Bad Request error when attempting to update a ticket. Investigation reveals that the `UpdateTicketDto` uses `@IsUUID()` validation on `assigneeAgentId` and `assigneeUserId` fields, but these fields can legitimately be `null` to clear an assignment. The `@IsUUID()` decorator rejects `null` values, causing valid requests to fail validation.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a PATCH request to `/api/tickets/:id` includes `assigneeAgentId: null` to clear the agent assignment THEN the system returns HTTP 400 Bad Request with a validation error because `@IsUUID()` rejects null values

1.2 WHEN a PATCH request to `/api/tickets/:id` includes `assigneeUserId: null` to clear the user assignment THEN the system returns HTTP 400 Bad Request with a validation error because `@IsUUID()` rejects null values

### Expected Behavior (Correct)

2.1 WHEN a PATCH request to `/api/tickets/:id` includes `assigneeAgentId: null` to clear the agent assignment THEN the system SHALL accept the request and set `assigneeAgentId` to null in the database

2.2 WHEN a PATCH request to `/api/tickets/:id` includes `assigneeUserId: null` to clear the user assignment THEN the system SHALL accept the request and set `assigneeUserId` to null in the database

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a PATCH request to `/api/tickets/:id` includes a valid UUID for `assigneeAgentId` THEN the system SHALL CONTINUE TO validate it as a UUID and update the ticket assignment

3.2 WHEN a PATCH request to `/api/tickets/:id` includes a valid UUID for `assigneeUserId` THEN the system SHALL CONTINUE TO validate it as a UUID and update the ticket assignment

3.3 WHEN a PATCH request to `/api/tickets/:id` includes an invalid non-null, non-UUID string for `assigneeAgentId` THEN the system SHALL CONTINUE TO return HTTP 400 Bad Request

3.4 WHEN a PATCH request to `/api/tickets/:id` includes an invalid non-null, non-UUID string for `assigneeUserId` THEN the system SHALL CONTINUE TO return HTTP 400 Bad Request

3.5 WHEN a PATCH request to `/api/tickets/:id` omits `assigneeAgentId` and `assigneeUserId` entirely THEN the system SHALL CONTINUE TO leave the existing assignments unchanged
