# Requirements Document

## Introduction

This document captures the gap between the Runa product specification and the current implementation. Runa is an AI-powered agentic agile team platform with a Kanban board, three AI agents (PM, Developer, Tester), a pipeline system, rules/learning loop, and GitHub integration. The backend uses NestJS + TypeScript with PostgreSQL and Redis; the frontend uses React + Vite + Tailwind CSS.

The requirements are organized by implementation phase, prioritizing core user-facing features (Phase 1) through infrastructure hardening (Phase 4).

## Glossary

- **Runa_App**: The full-stack web application comprising the NestJS backend and React frontend
- **Ticket_Card**: A draggable card on the Kanban board representing a work item
- **Ticket_Detail_Modal**: The modal dialog opened when clicking a ticket card, showing full ticket information
- **Agent_Inspector**: A panel or view that shows live and historical details of an AI agent's work (code changes, browser sessions, execution logs)
- **Rich_Text_Editor**: A WYSIWYG/Markdown editor component (Milkdown) used for ticket descriptions and comments
- **Pipeline_Prompt**: A UI element that appears after an agent completes work, offering the user options to advance the ticket through the pipeline
- **Play_Button**: A button on a Ticket_Card that triggers the appropriate AI agent for the ticket's current pipeline stage
- **Execution_History**: A chronological log of all agent actions (tool calls, file edits, commands) for a given execution
- **Monaco_Editor**: The VS Code editor component used to display live code changes made by the Developer agent
- **Browser_Stream_Viewer**: A component that displays a live or recorded Playwright browser session from the Tester agent
- **GitHub_Webhook_Listener**: A backend endpoint that receives and processes webhook events from GitHub (push, PR, etc.)
- **Token_Encryption_Service**: A backend service that encrypts and decrypts GitHub OAuth tokens at rest using AES-256
- **Pixel_Art_Avatar**: A custom pixel-art illustration representing each AI agent (PM, Developer, Tester)
- **Onboarding_Wizard**: A guided multi-step flow for new users to create a space, connect a GitHub repo, and configure the pipeline
- **File_Storage_Service**: A backend service for storing uploaded files (images, attachments) in S3 or MinIO

---

## Requirements

### Phase 1: Core Feature Gaps

---

### Requirement 1: Ticket Card Play Button

**User Story:** As a user, I want to click a play button on a ticket card to trigger the appropriate AI agent, so that I can manually kick off work without dragging tickets.

#### Acceptance Criteria

1. WHEN the user clicks the Play_Button on a Ticket_Card, THE Runa_App SHALL determine the appropriate agent based on the ticket's current status and pipeline stage mapping (development → Developer, testing → Tester)
2. WHEN the Play_Button is clicked and the agent is determined, THE Runa_App SHALL invoke the corresponding agent service with the ticket ID and move the ticket to the appropriate pipeline stage
3. WHILE an agent is actively processing a ticket triggered by the Play_Button, THE Ticket_Card SHALL display a loading indicator on the Play_Button
4. IF the ticket is in a status with no mapped agent (e.g., backlog, done), THEN THE Play_Button SHALL be visually disabled and non-interactive
5. IF the targeted agent is already active on another ticket, THEN THE Runa_App SHALL queue the request and display a tooltip indicating the agent is busy

---

### Requirement 2: Rich Text Editor for Ticket Descriptions

**User Story:** As a user, I want to write and view ticket descriptions in rich text with Markdown support, so that I can format acceptance criteria, code blocks, and structured content clearly.

#### Acceptance Criteria

1. THE Ticket_Detail_Modal SHALL render a Rich_Text_Editor (Milkdown) in place of the current plain textarea for the description field
2. THE Rich_Text_Editor SHALL support Markdown syntax including headings, bold, italic, code blocks, bullet lists, numbered lists, checkboxes, and links
3. WHEN the user pastes or uploads an image into the Rich_Text_Editor, THE Runa_App SHALL upload the image to the File_Storage_Service and insert an image reference into the description
4. WHEN viewing a ticket description outside the editor (e.g., on the Ticket_Card tooltip or read-only views), THE Runa_App SHALL render the Markdown content as formatted HTML
5. WHEN the user switches between edit and preview modes, THE Rich_Text_Editor SHALL preserve all content without data loss (round-trip: Markdown → rendered → Markdown produces equivalent content)

---

### Requirement 3: Rich Text for Comments

**User Story:** As a user, I want to write comments on tickets with Markdown formatting and image attachments, so that I can provide detailed feedback with screenshots.

#### Acceptance Criteria

1. THE Ticket_Detail_Modal SHALL provide a comment input area that supports Markdown formatting (bold, italic, code, links, lists)
2. WHEN the user attaches or pastes an image in the comment input, THE Runa_App SHALL upload the image to the File_Storage_Service and embed the image reference in the comment
3. THE Ticket_Detail_Modal SHALL render existing comments with Markdown formatting as HTML
4. WHEN a comment is saved, THE Runa_App SHALL persist the raw Markdown content and display the rendered version immediately

---

### Requirement 4: Agent Inspector — Execution History

**User Story:** As a user, I want to view the execution history of agent actions on a ticket, so that I can understand what the agent did and debug issues.

#### Acceptance Criteria

1. WHEN the user clicks an agent badge in the Agent_Panel, THE Runa_App SHALL open the Agent_Inspector panel showing the agent's recent executions
2. THE Agent_Inspector SHALL display a chronological list of Execution_History entries, each showing: timestamp, tool name, input summary, and status (success/failure)
3. WHEN the user selects a specific execution entry, THE Agent_Inspector SHALL expand to show the full tool input and output details
4. THE Runa_App SHALL provide a backend API endpoint (`GET /agents/:agentId/executions`) that returns paginated execution records for a given agent
5. WHEN an agent is actively running, THE Agent_Inspector SHALL display a live-updating log of actions as they occur via WebSocket events

---

### Requirement 5: Pipeline Progression Prompts

**User Story:** As a user, I want to see prompt buttons after an agent completes work on a ticket, so that I can choose to advance the ticket to the next pipeline stage or run the full pipeline.

#### Acceptance Criteria

1. WHEN an agent completes execution on a ticket, THE Runa_App SHALL display a Pipeline_Prompt banner on the Ticket_Detail_Modal with options: "Advance to next stage" and "Run full pipeline"
2. WHEN the user clicks "Advance to next stage", THE Runa_App SHALL move the ticket to the next pipeline stage and trigger the corresponding agent if that stage is enabled
3. WHEN the user clicks "Run full pipeline", THE Runa_App SHALL sequentially advance the ticket through all remaining enabled pipeline stages, triggering agents at each step
4. THE Pipeline_Prompt SHALL also appear as a WebSocket-driven notification in the board view when an agent completes work
5. IF the user does not interact with the Pipeline_Prompt, THE ticket SHALL remain in its current status until manually moved

---

### Requirement 6: Ticket State Transition History

**User Story:** As a user, I want to see the history of status changes for a ticket, so that I can track how it progressed through the pipeline.

#### Acceptance Criteria

1. WHEN a ticket's status changes, THE Runa_App SHALL record a transition entry containing: previous status, new status, timestamp, and trigger source (user drag, agent, pipeline auto-trigger)
2. THE Ticket_Detail_Modal SHALL display the transition history as a timeline below the description
3. THE Runa_App SHALL store transition history in a `statusHistory` JSONB column on the ticket entity
4. THE Runa_App SHALL provide the transition history in the ticket API response

---

### Phase 2: Agent Inspection & Observability

---

### Requirement 7: Agent Inspector — Live Code Viewer

**User Story:** As a user, I want to see the code changes an agent is making in real time, so that I can monitor implementation quality as it happens.

#### Acceptance Criteria

1. WHEN the Developer agent writes or edits a file during execution, THE Agent_Inspector SHALL display the file content in a Monaco_Editor component in read-only mode
2. THE Monaco_Editor SHALL support syntax highlighting for common languages (TypeScript, JavaScript, Python, JSON, HTML, CSS)
3. WHEN the Developer agent modifies a file, THE Agent_Inspector SHALL highlight the changed lines using diff decorations (green for additions, red for deletions)
4. THE Runa_App SHALL stream file change events from the backend to the frontend via WebSocket during active agent execution
5. WHEN no agent is actively running, THE Monaco_Editor SHALL display the last modified file from the most recent execution

---

### Requirement 8: Agent Inspector — Browser Session Viewer

**User Story:** As a user, I want to watch the Tester agent's browser session in real time, so that I can observe E2E test execution visually.

#### Acceptance Criteria

1. WHEN the Tester agent launches a Playwright browser session, THE Agent_Inspector SHALL display a Browser_Stream_Viewer showing the live browser viewport
2. THE Browser_Stream_Viewer SHALL render browser screenshots streamed via WebSocket at a minimum rate of 2 frames per second
3. WHEN the Tester agent's browser session ends, THE Browser_Stream_Viewer SHALL display the final screenshot with a "Session ended" overlay
4. IF the Tester agent is idle, THEN THE Browser_Stream_Viewer SHALL display a placeholder message indicating no active session

---

### Requirement 9: Pixel Art Agent Avatars

**User Story:** As a user, I want to see distinctive pixel art avatars for each AI agent, so that the agents feel like recognizable team members.

#### Acceptance Criteria

1. THE Runa_App SHALL display Pixel_Art_Avatar images for each agent type (PM, Developer, Tester) in the Agent_Panel, Chat_Panel agent badges, and Ticket_Detail_Modal comments
2. THE Pixel_Art_Avatar for each agent SHALL be a static PNG/SVG asset stored in the frontend `public/avatars/` directory
3. WHEN the agent status changes (idle, active, error), THE Pixel_Art_Avatar SHALL display a corresponding status ring (gray for idle, green pulsing for active, red for error)
4. THE Pixel_Art_Avatar SHALL replace the current colored circle with text label (PM, DE, QA) in all locations where agent identity is displayed

---

### Phase 3: GitHub Integration & Security

---

### Requirement 10: GitHub Token Encryption

**User Story:** As a user, I want my GitHub OAuth token to be encrypted at rest, so that my credentials are protected if the database is compromised.

#### Acceptance Criteria

1. THE Token_Encryption_Service SHALL encrypt GitHub OAuth tokens using AES-256-GCM before storing them in the `githubTokenEncrypted` column of the users table
2. THE Token_Encryption_Service SHALL derive the encryption key from the `ENCRYPTION_KEY` environment variable
3. WHEN the Runa_App needs to use a GitHub token (for API calls, repo cloning, or push operations), THE Token_Encryption_Service SHALL decrypt the token in memory and not persist the plaintext
4. WHEN a user re-authenticates with GitHub, THE Token_Encryption_Service SHALL encrypt the new token and overwrite the previous encrypted value
5. IF the `ENCRYPTION_KEY` environment variable is not set, THEN THE Runa_App SHALL refuse to start and log an error message indicating the missing configuration

---

### Requirement 11: GitHub Pull Request Creation

**User Story:** As a user, I want the Developer agent to automatically create a GitHub pull request after implementing a ticket, so that code changes are ready for review.

#### Acceptance Criteria

1. WHEN the Developer agent completes implementation and pushes a branch, THE Runa_App SHALL create a GitHub pull request via the GitHub API targeting the repository's default branch
2. THE pull request title SHALL include the ticket title and ID (format: `[TICKET-ID] Ticket Title`)
3. THE pull request body SHALL include the ticket description, a summary of changes from the agent, and a link back to the ticket in Runa
4. WHEN the pull request is created, THE Runa_App SHALL store the PR URL on the ticket entity and display it in the Ticket_Detail_Modal
5. IF pull request creation fails (e.g., permissions, conflicts), THEN THE Runa_App SHALL log the error, add a comment to the ticket with the failure reason, and keep the ticket in the review stage

---

### Requirement 12: GitHub Webhooks Listener

**User Story:** As a user, I want Runa to react to GitHub events (PR merged, push to main), so that tickets automatically advance when code is merged.

#### Acceptance Criteria

1. THE Runa_App SHALL expose a `POST /webhooks/github` endpoint that validates incoming GitHub webhook payloads using HMAC-SHA256 signature verification
2. WHEN a pull request merge event is received for a tracked branch, THE Runa_App SHALL move the associated ticket to the "staged" status
3. WHEN a push event is received on the default branch, THE Runa_App SHALL emit a WebSocket event to notify connected clients of the new commit
4. THE GitHub_Webhook_Listener SHALL ignore events from unrecognized repositories or spaces
5. IF webhook signature validation fails, THEN THE GitHub_Webhook_Listener SHALL return HTTP 401 and log the rejected request

---

### Requirement 13: Input Validation and Rate Limiting

**User Story:** As a developer, I want all API endpoints to validate input and enforce rate limits, so that the application is protected against malformed requests and abuse.

#### Acceptance Criteria

1. THE Runa_App SHALL apply class-validator decorators (DTOs) to all POST and PATCH endpoint request bodies across tickets, spaces, rules, and chat controllers
2. THE Runa_App SHALL return HTTP 400 with descriptive validation error messages when request bodies fail validation
3. THE Runa_App SHALL enforce rate limiting on all API endpoints using a configurable threshold (default: 100 requests per minute per IP for standard endpoints, 10 per minute for agent invocation endpoints)
4. IF a client exceeds the rate limit, THEN THE Runa_App SHALL return HTTP 429 with a `Retry-After` header
5. THE Runa_App SHALL apply rate limiting using the `@nestjs/throttler` module with Redis-backed storage for distributed deployments

---

### Requirement 14: Database Migrations

**User Story:** As a developer, I want the application to use TypeORM migrations instead of `synchronize: true`, so that schema changes are safe and reproducible in production.

#### Acceptance Criteria

1. THE Runa_App SHALL use TypeORM migrations for all database schema changes in production environments
2. THE Runa_App SHALL include a `data-source.ts` configuration file for the TypeORM CLI to generate and run migrations
3. WHEN the `NODE_ENV` environment variable is set to `production`, THE Runa_App SHALL set `synchronize: false` in the TypeORM configuration
4. THE Runa_App SHALL include initial migration files that create all existing tables (users, spaces, agents, tickets, executions, chat_messages, chat_attachments, rules, suggested_rules)
5. THE Runa_App SHALL provide npm scripts `migration:generate` and `migration:run` that work with the configured data source

---

### Phase 4: Infrastructure & Polish

---

### Requirement 15: File Storage Service (S3/MinIO)

**User Story:** As a user, I want uploaded images and attachments to be stored in object storage, so that file storage is scalable and persistent across deployments.

#### Acceptance Criteria

1. THE File_Storage_Service SHALL upload files to an S3-compatible object storage bucket (AWS S3 or MinIO for local development)
2. THE File_Storage_Service SHALL generate unique object keys using the pattern `{spaceId}/{entityType}/{entityId}/{uuid}.{extension}`
3. WHEN a file is uploaded, THE File_Storage_Service SHALL return a signed URL or proxy URL for retrieval
4. THE docker-compose.yml SHALL include a MinIO service for local development with a pre-configured bucket
5. THE Runa_App SHALL configure the storage backend via environment variables (`S3_ENDPOINT`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)

---

### Requirement 16: Onboarding Wizard

**User Story:** As a new user, I want a guided onboarding flow after first login, so that I can set up my first space with a GitHub repo and understand the pipeline.

#### Acceptance Criteria

1. WHEN a user logs in and has zero spaces, THE Runa_App SHALL display the Onboarding_Wizard instead of the empty space list
2. THE Onboarding_Wizard SHALL guide the user through three steps: (1) Create a space with a name, (2) Connect a GitHub repository from a list of the user's repos, (3) Configure which pipeline stages are enabled
3. WHEN the user completes all three steps, THE Runa_App SHALL create the space with the selected configuration and navigate to the board view
4. THE Onboarding_Wizard SHALL allow the user to skip the GitHub connection step and configure it later
5. WHEN the user skips a step, THE Onboarding_Wizard SHALL proceed to the next step without blocking progress

---

### Requirement 17: CI/CD Pipeline

**User Story:** As a developer, I want an automated CI/CD pipeline, so that code changes are tested and deployed consistently.

#### Acceptance Criteria

1. THE Runa_App SHALL include a GitHub Actions workflow file (`.github/workflows/ci.yml`) that runs on push to `main` and on pull requests
2. THE CI workflow SHALL execute: install dependencies, lint, type-check, and run unit tests for both backend and frontend
3. THE CI workflow SHALL build Docker images for backend and frontend and push them to a container registry on successful merge to `main`
4. THE Runa_App SHALL include a deployment workflow (`.github/workflows/deploy.yml`) that deploys to the configured EC2 instance via SSH after a successful CI build on `main`
5. IF any CI step fails, THEN THE workflow SHALL fail the entire pipeline and report the failure in the PR checks

---

### Requirement 18: Monitoring and Logging

**User Story:** As a developer, I want structured logging and health check endpoints, so that I can monitor application health and debug production issues.

#### Acceptance Criteria

1. THE Runa_App SHALL use a structured JSON logging format in production (using NestJS built-in logger or Winston)
2. THE Runa_App SHALL expose a `GET /health` endpoint that returns HTTP 200 with database and Redis connectivity status
3. THE Runa_App SHALL log all agent execution start/complete/fail events with execution ID, agent type, ticket ID, and duration
4. THE Runa_App SHALL log all API requests with method, path, status code, and response time
5. IF the database or Redis connection is unhealthy, THEN THE health endpoint SHALL return HTTP 503 with details of the failing dependency
