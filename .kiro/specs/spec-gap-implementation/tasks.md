# Implementation Plan: Spec Gap Implementation

## Overview

Incremental implementation of 18 requirements across 4 phases for the Runa platform. Each task builds on previous work, starting with backend foundations and wiring through to frontend components. Property-based tests use fast-check. The backend is NestJS + TypeScript; the frontend is React 19 + Vite + Tailwind CSS v4.

## Tasks

### Phase 1: Core Feature Gaps

- [x] 1. Ticket Card Play Button (Req 1)
  - [x] 1.1 Add `POST /tickets/:id/trigger-agent` endpoint to `TicketsController`
    - Create `TriggerAgentDto` (empty body, ticketId from URL param)
    - Add `triggerAgentForTicket(ticketId)` method to `PipelineService` that determines agent from `STAGE_AGENT_MAP` and invokes it
    - Return `{ queued: true, agentType }` or `{ error: 'no_mapped_agent' }` with HTTP 400
    - If agent is busy (`activeRuns.has`), queue the request and return `{ queued: true }`
    - _Requirements: 1.1, 1.2, 1.5_

  - [x] 1.2 Write property test for status-to-agent mapping (Property 1)
    - **Property 1: Status-to-agent mapping determines play button state**
    - Test file: `backend/src/pipeline/__tests__/pipeline.property.spec.ts`
    - Generator: `fc.constantFrom(...allStatuses)` — verify enabled iff status has mapped agent
    - **Validates: Requirements 1.1, 1.4**

  - [x] 1.3 Add `useTriggerAgent` hook and wire Play Button in `TicketCard.tsx`
    - Create `useTriggerAgent` mutation hook calling `POST /tickets/${ticketId}/trigger-agent`
    - Wire `onPlay` handler to the existing `<FiPlay>` button in `TicketCard.tsx`
    - Show spinner on play button while agent is active (subscribe to `agent_status` WebSocket event)
    - Disable button when ticket status is `backlog` or `done` (visually disabled, non-interactive)
    - Show tooltip when agent is busy indicating queued status
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Rich Text Editor for Ticket Descriptions (Req 2)
  - [x] 2.1 Install Milkdown packages and create RichTextEditor component
    - Install: @milkdown/core, @milkdown/react, @milkdown/preset-commonmark, @milkdown/preset-gfm, @milkdown/plugin-listener, @milkdown/plugin-upload, @milkdown/theme-nord, @milkdown/ctx
    - Create frontend/src/components/RichTextEditor.tsx wrapping Milkdown with useEditor hook
    - Props: content: string, onChange: (markdown: string) => void, readonly: boolean
    - Plugins: commonmark (headings, bold, italic, code blocks, lists, links), gfm (task lists, tables, strikethrough), listener (onChange), upload (image paste/drop calls POST /files/upload)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.2 Replace textarea with RichTextEditor in TicketDetailModal
    - Replace the textarea for description with RichTextEditor
    - Add edit/preview toggle button
    - Read-only mode uses RichTextEditor with readonly=true
    - Render Markdown as formatted HTML in read-only views (ticket card tooltip, etc.)
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 2.3 Write property test for Markdown round-trip (Property 2)
    - **Property 2: Markdown editor round-trip preserves content**
    - Test file: frontend/src/**tests**/rich-text.property.spec.ts
    - Generator: fc.string() with Markdown-like patterns — load into Milkdown, extract back, verify semantic equivalence
    - **Validates: Requirements 2.5**

- [x] 3. Rich Text Comments (Req 3)
  - [x] 3.1 Add comment API endpoint and backend logic
    - Add POST /tickets/:id/comments endpoint to TicketsController
    - Create CreateCommentDto with @IsString() @IsNotEmpty() content: string
    - Append comment to JSONB comments array: { id: uuid, authorType, authorId, content, createdAt }
    - _Requirements: 3.2, 3.4_

  - [x] 3.2 Add comment input with Milkdown in TicketDetailModal
    - Add a smaller RichTextEditor instance as comment input area
    - Submit button calls POST /tickets/:id/comments with { content: markdownString }
    - Render existing comments with RichTextEditor readonly=true content=comment.content
    - Support image paste/upload in comments via the upload plugin
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 3.3 Write property test for comment round-trip (Property 3)
    - **Property 3: Comment persistence round-trip**
    - Test file: backend/src/tickets/**tests**/comments.property.spec.ts
    - Generator: fc.string() for content — save via API, fetch ticket, verify content matches
    - **Validates: Requirements 3.4**

- [x] 4. Agent Inspector — Execution History (Req 4)
  - [x] 4.1 Add paginated GET /agents/:agentId/executions endpoint
    - Extend AgentsController with paginated query on executions table, ordered by startTime DESC
    - Response shape: { data: Execution[], total: number, page: number }
    - Accept page and limit query params (default limit=20)
    - _Requirements: 4.4_

  - [x] 4.2 Add execution_action WebSocket event to agent services
    - In DeveloperAgentService and TesterAgentService, emit execution_action event via EventsGateway when a tool_use block is processed
    - Payload: { executionId, agentId, tool, inputSummary, timestamp }
    - Add emitExecutionAction helper to EventsGateway
    - _Requirements: 4.5_

  - [x] 4.3 Create AgentInspector panel component
    - Create frontend/src/features/agents/AgentInspector.tsx as a slide-over panel
    - Opens when clicking an agent badge in AgentPanel
    - Fetches GET /agents/:agentId/executions?page=1&limit=20 via new useExecutions hook
    - Displays chronological list: timestamp, tool name, input summary, status badge
    - Expandable rows show full tool input/output JSON
    - Live mode: subscribes to execution_action WebSocket event for real-time log streaming
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 4.4 Write property tests for execution history (Properties 4, 5)
    - **Property 4: Execution history is chronologically ordered with required fields**
    - **Property 5: Execution pagination returns correct page sizes**
    - Test file: backend/src/agents/**tests**/executions.property.spec.ts
    - Generators: fc.array(fc.record({...})) for entries, fc.nat() for page/limit
    - **Validates: Requirements 4.2, 4.4**

- [x] 5. Pipeline Progression Prompts (Req 5)
  - [x] 5.1 Add POST /tickets/:id/advance and POST /tickets/:id/run-pipeline endpoints
    - Extend PipelineController with advance endpoint: moves ticket to next enabled stage, triggers agent if mapped
    - Add run-pipeline endpoint: sequentially advances through all remaining enabled stages
    - Emit pipeline_completed WebSocket event when agent finishes: { ticketId, completedStage, nextStage, agentType }
    - _Requirements: 5.2, 5.3_

  - [x] 5.2 Create PipelinePrompt banner component
    - Create frontend/src/components/PipelinePrompt.tsx
    - Banner displayed in TicketDetailModal when pipeline_completed event fires
    - Two buttons: "Advance to next stage" calls POST /tickets/:id/advance, "Run full pipeline" calls POST /tickets/:id/run-pipeline
    - Also shown as a toast notification on the board via WebSocket
    - If user does not interact, ticket remains in current status
    - Subscribe to pipeline_completed WebSocket event in useSocketEvents
    - _Requirements: 5.1, 5.4, 5.5_

  - [x] 5.3 Write property tests for pipeline progression (Properties 6, 7)
    - **Property 6: Pipeline advance moves ticket to next enabled stage**
    - **Property 7: Full pipeline run reaches final enabled stage**
    - Test file: backend/src/pipeline/**tests**/pipeline.property.spec.ts
    - Generators: fc.constantFrom(...stages) + fc.record() for pipeline config
    - **Validates: Requirements 5.2, 5.3**

- [x] 6. Ticket State Transition History (Req 6)
  - [x] 6.1 Add statusHistory JSONB column to Ticket entity and update services
    - Add statusHistory JSONB column to Ticket entity: Array of { from, to, timestamp, trigger } (default [])
    - Modify TicketsService.moveTicket() to append transition entry before saving (with trigger param)
    - Modify TicketsService.update() to record transitions when status changes
    - Include statusHistory in ticket API responses
    - _Requirements: 6.1, 6.3, 6.4_

  - [x] 6.2 Create TransitionTimeline component in TicketDetailModal
    - Create frontend/src/components/TransitionTimeline.tsx
    - Render vertical timeline with status badges, timestamps, and trigger icons (user drag, agent, pipeline)
    - Display below description in TicketDetailModal
    - Update Ticket type in frontend/src/types/index.ts to include statusHistory
    - _Requirements: 6.2_

  - [x] 6.3 Write property test for transition history (Property 8)
    - **Property 8: Status transitions are recorded with correct metadata**
    - Test file: backend/src/tickets/**tests**/transitions.property.spec.ts
    - Generator: fc.constantFrom(...statuses) pairs — verify statusHistory grows by 1 with correct from/to/timestamp/trigger
    - **Validates: Requirements 6.1, 6.3**

- [x] 7. Checkpoint — Phase 1
  - Ensure all tests pass, ask the user if questions arise.

### Phase 2: Agent Inspection & Observability

- [x] 8. Agent Inspector — Live Code Viewer (Req 7)
  - [x] 8.1 Add file_change WebSocket event to Developer agent
    - In DeveloperAgentService, when a Write or Edit tool_use is detected, emit file_change event via EventsGateway
    - Payload: { executionId, filePath, content, diff: { additions: number[], deletions: number[] } }
    - Add emitFileChange helper to EventsGateway
    - _Requirements: 7.4_

  - [x] 8.2 Create MonacoCodeViewer component
    - Install @monaco-editor/react in frontend
    - Create frontend/src/features/agents/MonacoCodeViewer.tsx in read-only mode
    - Subscribe to file_change WebSocket event
    - Apply diff decorations (green for additions, red for deletions) using Monaco deltaDecorations API
    - Auto-detect language from file extension (TypeScript, JavaScript, Python, JSON, HTML, CSS)
    - When no agent is running, display last modified file from most recent execution
    - Integrate into AgentInspector panel
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [x] 9. Agent Inspector — Browser Session Viewer (Req 8)
  - [x] 9.1 Add browser screenshot streaming to Tester agent
    - In TesterAgentService, hook into Playwright MCP server screenshot events
    - Forward screenshots as base64 JPEG via browser_screenshot WebSocket event at ~2fps
    - Emit browser_session_end when Playwright session closes
    - Add emitBrowserScreenshot and emitBrowserSessionEnd helpers to EventsGateway
    - _Requirements: 8.1, 8.2_

  - [x] 9.2 Create BrowserStreamViewer component
    - Create frontend/src/features/agents/BrowserStreamViewer.tsx
    - Display img tag that updates src from browser_screenshot WebSocket events
    - Show "Session ended" overlay when browser_session_end event fires
    - Show placeholder when no active session
    - Integrate into AgentInspector panel
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 10. Pixel Art Agent Avatars (Req 9)
  - [x] 10.1 Add pixel art avatar assets and update components
    - Add 64x64 pixel art PNG assets: frontend/public/avatars/pm.png, developer.png, tester.png
    - Replace colored circle + text label with img src="/avatars/{agentType}.png" in AgentPanel, ChatPanel, and TicketDetailModal comments
    - Add status ring: CSS ring-2 with color based on agent status (gray=idle, green pulsing=active, red=error)
    - Create getStatusRingClass(status) utility function for consistent mapping
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 10.2 Write property test for avatar ring mapping (Property 9)
    - **Property 9: Agent status maps to correct avatar ring color**
    - Test file: frontend/src/**tests**/avatar.property.spec.ts
    - Generator: fc.constantFrom('idle', 'active', 'error') — verify correct CSS class for each status
    - **Validates: Requirements 9.3**

- [x] 11. Checkpoint — Phase 2
  - Ensure all tests pass, ask the user if questions arise.

### Phase 3: GitHub Integration & Security

- [x] 12. GitHub Token Encryption (Req 10)
  - [x] 12.1 Create TokenEncryptionService
    - Create backend/src/common/token-encryption.service.ts
    - Implement encrypt(plaintext): uses crypto.createCipheriv('aes-256-gcm', key, iv) with random 12-byte IV, returns base64(iv + ciphertext + authTag)
    - Implement decrypt(encrypted): extracts IV, ciphertext, authTag from base64, decrypts
    - Key derived from ENCRYPTION_KEY env var (32-byte hex string)
    - Add startup guard in main.ts: if ENCRYPTION_KEY is missing, log error and refuse to start (process.exit(1))
    - _Requirements: 10.1, 10.2, 10.5_

  - [x] 12.2 Integrate encryption into AuthService and GithubService
    - Modify AuthService.githubCallback() to call encrypt() before storing githubTokenEncrypted
    - Modify GithubService.getToken() to call decrypt() before returning the token
    - Ensure plaintext token is never persisted, only used in memory
    - Handle re-authentication: encrypt new token and overwrite previous value
    - _Requirements: 10.3, 10.4_

  - [x] 12.3 Write property test for token encryption (Property 10)
    - **Property 10: Token encryption round-trip and ciphertext differs from plaintext**
    - Test file: backend/src/common/**tests**/encryption.property.spec.ts
    - Generator: fc.string({ minLength: 1 }) — encrypt then decrypt, verify round-trip; verify ciphertext != plaintext
    - **Validates: Requirements 10.1, 10.3**

- [x] 13. GitHub Pull Request Creation (Req 11)
  - [x] 13.1 Add prUrl column to Ticket entity and extend GithubService
    - Add prUrl column (nullable string) to Ticket entity
    - Add createPullRequest(spaceId, branchName, ticketId) method to GithubService
    - Uses GitHub REST API POST /repos/{owner}/{repo}/pulls
    - Title format: [{ticketId}] {ticketTitle}
    - Body includes ticket description + agent summary + link back to Runa
    - Update Ticket type in frontend types/index.ts to include prUrl
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 13.2 Wire PR creation into Developer agent and display in UI
    - Modify DeveloperAgentService: after pushing branch, call githubService.createPullRequest()
    - Store PR URL on ticket entity
    - Display PR URL as a link in TicketDetailModal
    - On failure: log error, add comment to ticket with failure reason, keep ticket in review stage
    - _Requirements: 11.4, 11.5_

  - [x] 13.3 Write property test for PR formatting (Property 11)
    - **Property 11: PR title and body contain required ticket information**
    - Test file: backend/src/agents/**tests**/github.property.spec.ts
    - Generator: fc.record({ id: fc.uuid(), title: fc.string(), description: fc.string() }) — verify title format and body contains description + URL
    - **Validates: Requirements 11.2, 11.3**

- [x] 14. GitHub Webhooks Listener (Req 12)
  - [x] 14.1 Create webhooks module and controller
    - Create backend/src/webhooks/webhooks.module.ts and backend/src/webhooks/webhooks.controller.ts
    - POST /webhooks/github endpoint with raw body access for HMAC-SHA256 verification
    - Validate X-Hub-Signature-256 header against GITHUB_WEBHOOK_SECRET env var
    - Handle pull_request event (merged -> move associated ticket to "staged")
    - Handle push event (emit github_push WebSocket event to notify clients)
    - Ignore events from unrecognized repositories (no matching space githubRepoUrl)
    - Return HTTP 401 on invalid signature, log rejected request
    - Register WebhooksModule in AppModule
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 14.2 Write property tests for webhooks (Properties 12, 13)
    - **Property 12: Webhook HMAC-SHA256 signature verification**
    - **Property 13: Webhook ignores unrecognized repositories**
    - Test file: backend/src/webhooks/**tests**/webhooks.property.spec.ts
    - Generators: fc.string() for payload/secret (P12), fc.webUrl() for random repo URLs (P13)
    - **Validates: Requirements 12.1, 12.4**

- [x] 15. Input Validation and Rate Limiting (Req 13)
  - [x] 15.1 Create DTOs for all controllers
    - Create CreateTicketDto, UpdateTicketDto, MoveTicketDto with class-validator decorators
    - Create CreateSpaceDto, UpdateSpaceDto
    - Create SendChatMessageDto
    - Create CreateRuleDto, UpdateRuleDto
    - Create CreateCommentDto (if not already done in task 3.1)
    - Apply DTOs to all POST and PATCH endpoint request bodies in tickets, spaces, rules, and chat controllers
    - Ensure ValidationPipe({ whitelist: true, transform: true }) is applied globally (already in main.ts)
    - _Requirements: 13.1, 13.2_

  - [x] 15.2 Add rate limiting with @nestjs/throttler and Redis storage
    - Install @nestjs/throttler
    - Configure ThrottlerModule in AppModule with Redis-backed storage
    - Default: { ttl: 60000, limit: 100 } for standard endpoints
    - Agent invocation endpoints: @Throttle({ default: { ttl: 60000, limit: 10 } }) on trigger-agent, advance, run-pipeline
    - Return HTTP 429 with Retry-After header when limit exceeded
    - _Requirements: 13.3, 13.4, 13.5_

  - [x] 15.3 Write property tests for validation and rate limiting (Properties 14, 15)
    - **Property 14: DTO validation rejects invalid input with HTTP 400**
    - **Property 15: Rate limiting enforces request threshold**
    - Test files: backend/src/tickets/**tests**/validation.property.spec.ts, backend/src/**tests**/throttle.property.spec.ts
    - Generators: fc.record() with invalid field combinations (P14), fc.nat() for request counts (P15)
    - **Validates: Requirements 13.1, 13.2, 13.3**

- [x] 16. Database Migrations (Req 14)
  - [x] 16.1 Create data-source.ts and initial migration
    - Create backend/src/data-source.ts TypeORM DataSource config for CLI usage (reads from env vars, synchronize: false)
    - Modify AppModule TypeORM config: set synchronize conditional on NODE_ENV !== 'production'
    - Create backend/src/migrations/ directory
    - Generate initial migration creating all 9 existing tables (users, spaces, agents, tickets, executions, chat_messages, chat_attachments, rules, suggested_rules)
    - Verify migration:generate and migration:run npm scripts work with the configured data source
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 17. Checkpoint — Phase 3
  - Ensure all tests pass, ask the user if questions arise.

### Phase 4: Infrastructure & Polish

- [x] 18. File Storage Service — S3/MinIO (Req 15)
  - [x] 18.1 Create FileStorageService and file upload controller
    - Install @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner in backend
    - Create backend/src/common/file-storage.service.ts with upload() and getSignedUrl() methods
    - Uses @aws-sdk/client-s3 — compatible with both S3 and MinIO
    - Key pattern: {spaceId}/{entityType}/{entityId}/{uuid}.{extension}
    - Configured via env vars: S3_ENDPOINT, S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
    - Create backend/src/common/files.controller.ts with POST /files/upload (multipart) and GET /files/:key (proxy/redirect to signed URL)
    - Create backend/src/common/common.module.ts to export FileStorageService and TokenEncryptionService
    - _Requirements: 15.1, 15.2, 15.3, 15.5_

  - [x] 18.2 Add MinIO service to docker-compose.yml
    - Add MinIO container with pre-configured bucket
    - Add environment variables for S3 endpoint and credentials
    - _Requirements: 15.4_

  - [x] 18.3 Write property test for file storage key format (Property 16)
    - **Property 16: File storage key follows naming pattern**
    - Test file: backend/src/common/**tests**/file-storage.property.spec.ts
    - Generator: fc.uuid() for IDs, fc.constantFrom(...) for entity types — verify key matches {spaceId}/{entityType}/{entityId}/{uuid}.{extension}
    - **Validates: Requirements 15.2**

- [x] 19. Onboarding Wizard (Req 16)
  - [x] 19.1 Create OnboardingWizard component
    - Create frontend/src/features/onboarding/OnboardingWizard.tsx
    - 3-step wizard: (1) Create space with name, (2) Connect GitHub repo from user's repos list, (3) Configure pipeline stages
    - Step 2 (GitHub) is skippable — proceed to step 3 without blocking
    - On completion, create space via POST /spaces and navigate to board view
    - Reuse existing hooks: useCreateSpace, useGithubRepositories, pipeline config hooks
    - _Requirements: 16.2, 16.3, 16.4, 16.5_

  - [x] 19.2 Integrate wizard into SpaceListPage
    - Modify SpaceListPage.tsx: if spaces.length === 0, render OnboardingWizard instead of the current space creation form
    - _Requirements: 16.1_

  - [x] 19.3 Write property test for wizard step advancement (Property 17)
    - **Property 17: Onboarding wizard step advancement**
    - Test file: frontend/src/**tests**/onboarding.property.spec.ts
    - Generator: fc.constantFrom(1, 2, 3) + fc.boolean() for skip — verify complete/skip advances to next step, skipping step 2 doesn't block step 3
    - **Validates: Requirements 16.5**

- [x] 20. CI/CD Pipeline (Req 17)
  - [x] 20.1 Create GitHub Actions CI workflow
    - Create .github/workflows/ci.yml
    - Triggers: push to main, pull requests
    - Steps: install dependencies, lint, type-check, run unit tests for both backend and frontend
    - Build Docker images for backend and frontend on successful merge to main
    - Push images to container registry
    - Fail entire pipeline if any step fails, report in PR checks
    - _Requirements: 17.1, 17.2, 17.3, 17.5_

  - [x] 20.2 Create GitHub Actions deploy workflow
    - Create .github/workflows/deploy.yml
    - Triggers: after successful CI on main
    - Deploy to configured EC2 instance via SSH
    - _Requirements: 17.4_

- [x] 21. Monitoring and Logging (Req 18)
  - [x] 21.1 Create health check endpoint
    - Create backend/src/health/health.module.ts and backend/src/health/health.controller.ts
    - GET /health endpoint (no auth required) — checks PostgreSQL and Redis connectivity
    - Returns { status: 'ok', db: 'up', redis: 'up' } with HTTP 200 when healthy
    - Returns { status: 'error', db: 'down' or 'up', redis: 'down' or 'up' } with HTTP 503 when unhealthy
    - Register HealthModule in AppModule
    - _Requirements: 18.2, 18.5_

  - [x] 21.2 Add structured logging and request logging middleware
    - Configure NestJS logger to output JSON format when NODE_ENV=production
    - Create request logging middleware: logs method, path, status code, response time for all API requests
    - Add agent execution logging in DeveloperAgentService and TesterAgentService: log start/complete/fail events with executionId, agentType, ticketId, duration
    - _Requirements: 18.1, 18.3, 18.4_

  - [x] 21.3 Write property tests for logging (Properties 18, 19)
    - **Property 18: Agent execution log contains required fields**
    - **Property 19: Request log contains required fields**
    - Test files: backend/src/agents/**tests**/logging.property.spec.ts, backend/src/**tests**/logging.property.spec.ts
    - Generators: fc.record() for execution events (P18), fc.record({ method, path, statusCode }) for request logs (P19)
    - **Validates: Requirements 18.3, 18.4**

- [x] 22. Final Integration and Wiring
  - [x] 22.1 Wire all new WebSocket events into useSocketEvents
    - Add handlers for: execution_action, pipeline_completed, file_change, browser_screenshot, browser_session_end, github_push
    - Invalidate appropriate React Query caches for each event
    - _Requirements: 4.5, 5.4, 7.4, 8.2, 12.3_

  - [x] 22.2 Update frontend types and API hooks
    - Ensure all new types are added to frontend/src/types/index.ts: statusHistory, prUrl on Ticket, execution action payloads, pipeline prompt payloads
    - Ensure all new API hooks are created: useTriggerAgent, useExecutions, useAdvanceTicket, useRunPipeline, useAddComment, useUploadFile
    - _Requirements: all_

- [x] 23. Final Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with \* are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints at end of each phase ensure incremental validation
- Property tests use fast-check with { numRuns: 100 } minimum
- Milkdown (MIT licensed) is used for rich text editing — NOT TipTap
- All backend code is TypeScript (NestJS), all frontend code is TypeScript (React 19 + Vite)
- The design specifies 19 correctness properties mapped to property-based tests
