# Requirements Document

## Introduction

This feature overhauls the frontend UI of the agent-driven Kanban board application. The changes span eight areas: converting the fixed chat panel into a floating bubble with a modal, adding an audit toolbar for action history, enabling ticket deletion, fixing drag-and-drop ghost rendering, showing agent assignment and activity on task cards, adding a chat shortcut from the agent inspector, fixing the Pipeline Settings modal layout, and polishing the chat UI.

## Glossary

- **Board_Page**: The main page (`BoardPage`) that renders the Kanban board, toolbar, and related panels for a given space.
- **Chat_Bubble**: A new floating circular button rendered in the bottom-right corner of the Board_Page that opens the Chat_Modal.
- **Chat_Modal**: A new overlay dialog containing the full chat interface, replacing the fixed Chat_Panel.
- **Chat_Panel**: The existing fixed-height chat component (`ChatPanel`) currently embedded at the bottom of the Board_Page.
- **Agent_Selector**: A dropdown/select control inside the Chat_Modal that allows the user to pick which agent to chat with, displaying agent avatars.
- **Audit_Toolbar**: A new closable horizontal bar at the bottom of the Board_Page that displays a chronological log of all agent calls, user actions, and system events.
- **Ticket_Card**: The draggable card component (`TicketCard`) representing a single ticket on the Kanban board.
- **Kanban_Board**: The drag-and-drop board component (`KanbanBoard`) using @dnd-kit/core with a `DragOverlay`.
- **Drag_Overlay**: The @dnd-kit `DragOverlay` component that renders a floating copy of the dragged card.
- **Agent_Inspector**: The slide-over panel (`AgentInspector`) that shows execution history and live actions for a selected agent.
- **Pipeline_Settings_Modal**: The centered modal (`PipelineSettings`) for toggling pipeline stage automation.
- **Agent_Avatar**: The pixel-art SVG image for an agent type, retrieved via `getAvatarSrc()`.
- **Spinning_Border**: A CSS border animation applied to a Ticket_Card when the assigned agent is actively working on that ticket.
- **Ticket**: A task entity with fields including `id`, `title`, `status`, `priority`, `assigneeAgentId`, and `comments`.
- **Agent**: An entity with fields including `id`, `agentType`, `status`, and `avatarRef`.

## Requirements

### Requirement 1: Floating Chat Bubble

**User Story:** As a user, I want the chat to be accessible via a floating bubble instead of a fixed panel, so that the Kanban board has more vertical space and the chat does not obstruct the view.

#### Acceptance Criteria

1. WHEN the Board_Page renders, THE Chat_Bubble SHALL appear as a circular floating button in the bottom-right corner of the viewport, above any other bottom-positioned UI.
2. WHEN the user clicks the Chat_Bubble, THE Chat_Modal SHALL open as a centered overlay dialog containing the full chat interface.
3. WHEN the Chat_Modal is open, THE Chat_Bubble SHALL be hidden.
4. WHEN the user closes the Chat_Modal (via close button or backdrop click), THE Chat_Modal SHALL close and THE Chat_Bubble SHALL reappear.
5. THE Board_Page SHALL no longer render the fixed-height Chat_Panel at the bottom of the page.
6. THE Chat_Bubble SHALL display an unread indicator badge WHEN there are new messages since the user last opened the Chat_Modal.

### Requirement 2: Agent Selector Dropdown in Chat

**User Story:** As a user, I want to select the target agent from a dropdown with avatars instead of toggle buttons, so that agent selection is clearer and more compact.

#### Acceptance Criteria

1. THE Chat_Modal SHALL display an Agent_Selector dropdown in the header area instead of the current row of toggle buttons.
2. THE Agent_Selector SHALL list all available agent types (PM, Developer, Tester) with their corresponding Agent_Avatar and display name.
3. WHEN the user selects an agent from the Agent_Selector, THE Chat_Modal SHALL update the active agent for sending messages.
4. THE Agent_Selector SHALL visually indicate the currently selected agent.

### Requirement 3: Audit Toolbar

**User Story:** As a user, I want to see a chronological log of all actions in the app, so that I can track what agents and users have done.

#### Acceptance Criteria

1. THE Board_Page SHALL render the Audit_Toolbar as a horizontal bar at the bottom of the page.
2. THE Audit_Toolbar SHALL display a chronological list of events including agent execution actions (received via `execution_action` WebSocket events), pipeline completions (received via `pipeline_completed` WebSocket events), and user-initiated actions (ticket creation, ticket moves, agent triggers).
3. WHEN a new event occurs, THE Audit_Toolbar SHALL prepend the event to the list in real time.
4. THE Audit_Toolbar SHALL display each event with a timestamp, event type icon, and a summary description.
5. WHEN the user clicks the close button on the Audit_Toolbar, THE Audit_Toolbar SHALL collapse and hide from view.
6. WHEN the Audit_Toolbar is closed, THE Board_Page SHALL display a small toggle button to reopen the Audit_Toolbar.
7. THE Audit_Toolbar SHALL have a maximum height and scroll internally when the event list exceeds the visible area.

### Requirement 4: Deletable Tickets

**User Story:** As a user, I want to delete tickets from the board, so that I can remove tickets that are no longer needed.

#### Acceptance Criteria

1. THE Ticket_Card SHALL display a delete button (visible on hover).
2. WHEN the user clicks the delete button on a Ticket_Card, THE system SHALL show a confirmation prompt before deleting.
3. WHEN the user confirms deletion, THE system SHALL send a DELETE request to the backend API endpoint `DELETE /tickets/:id`.
4. WHEN the backend confirms deletion, THE Kanban_Board SHALL remove the Ticket from the board without a full page reload.
5. IF the DELETE request fails, THEN THE system SHALL display an error notification and retain the Ticket on the board.
6. THE backend TicketsController SHALL expose a `DELETE /tickets/:id` endpoint that deletes the ticket and its associated comments.

### Requirement 5: Drag and Drop Ghost Fix

**User Story:** As a user, I want the original card to be hidden while dragging, so that there is no confusing shadow/duplicate card on the board.

#### Acceptance Criteria

1. WHILE a Ticket_Card is being dragged (an active drag is in progress), THE original Ticket_Card in the board column SHALL be visually hidden (opacity 0 or display none).
2. WHILE a Ticket_Card is being dragged, THE Drag_Overlay SHALL render the only visible copy of the card.
3. WHEN the drag ends, THE original Ticket_Card SHALL become visible again at its final position.

### Requirement 6: Task Card Agent Assignment Display

**User Story:** As a user, I want to see which agent is assigned to a ticket directly on the card, so that I can quickly identify ownership and activity.

#### Acceptance Criteria

1. WHEN a Ticket has a non-null `assigneeAgentId`, THE Ticket_Card SHALL display the assigned agent's Agent_Avatar on the card.
2. WHEN a Ticket has no `assigneeAgentId`, THE Ticket_Card SHALL not display any agent avatar.
3. WHILE the assigned agent's status is `active` and the agent is working on that specific Ticket, THE Ticket_Card SHALL display a Spinning_Border animation around the card.
4. WHEN the assigned agent's status changes from `active` to `idle` or `error`, THE Spinning_Border animation SHALL stop.
5. THE Spinning_Border SHALL be implemented as a CSS animation (e.g., a rotating conic-gradient border) using Tailwind CSS utilities or a custom keyframe in `index.css`.

### Requirement 7: Agent Inspector Chat Button

**User Story:** As a user, I want to start a chat with an agent directly from the Agent_Inspector, so that I can quickly communicate with the agent I am inspecting.

#### Acceptance Criteria

1. THE Agent_Inspector SHALL display a "Chat with [Agent Name]" button in its header area.
2. WHEN the user clicks the chat button in the Agent_Inspector, THE Chat_Modal SHALL open with the Agent_Selector pre-set to the inspected agent's type.
3. WHEN the Chat_Modal opens from the Agent_Inspector, THE Agent_Inspector SHALL close.

### Requirement 8: Pipeline Settings Modal Fix

**User Story:** As a user, I want the Pipeline Settings modal to render correctly, so that I can configure pipeline stages without layout issues.

#### Acceptance Criteria

1. THE Pipeline_Settings_Modal SHALL render toggle switches aligned to the right of each stage row with consistent spacing.
2. THE Pipeline_Settings_Modal SHALL render stage cards with uniform padding, border radius, and spacing between cards.
3. THE Pipeline_Settings_Modal SHALL be vertically centered in the viewport and not overflow the screen on standard viewport sizes (1024px height and above).
4. THE Pipeline_Settings_Modal close button SHALL be properly aligned to the top-right corner of the modal header.

### Requirement 9: Chat UI Polish

**User Story:** As a user, I want the chat interface to look polished and modern while remaining clean, so that the experience feels professional.

#### Acceptance Criteria

1. THE Chat_Modal SHALL have rounded corners, a subtle shadow, and a semi-transparent backdrop consistent with other modals in the application.
2. THE Chat_Modal message bubbles SHALL have distinct visual styling for user messages versus agent messages, including the agent's Agent_Avatar next to agent messages.
3. THE Chat_Modal input area SHALL include the existing image attachment button, a text input, and a send button with consistent spacing and alignment.
4. THE Chat_Modal SHALL be responsive, occupying a maximum width of 640px and a maximum height of 80vh.
5. WHILE a message is being sent, THE Chat_Modal send button SHALL display a loading indicator and be disabled.
