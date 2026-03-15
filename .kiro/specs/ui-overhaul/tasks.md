# Implementation Plan: UI Overhaul

## Overview

Incremental implementation of nine coordinated UI improvements to the Kanban board application. Tasks are ordered so each step builds on the previous: shared state (ChatContext) first, then new components, then modifications to existing components, backend changes, and finally wiring and polish.

## Tasks

- [x] 1. Create ChatContext and spinning border CSS
  - [x] 1.1 Create `frontend/src/contexts/ChatContext.tsx` with `ChatProvider` and `useChatContext` hook
    - Implement `ChatContextValue` interface: `isOpen`, `selectedAgent`, `unreadCount`, `openChat(agentType?)`, `closeChat()`, `markRead()`
    - Default `selectedAgent` to `"pm"`, `isOpen` to `false`, `unreadCount` to `0`
    - `openChat` sets `isOpen = true` and optionally sets `selectedAgent`
    - `closeChat` sets `isOpen = false`
    - `markRead` resets `unreadCount` to `0`
    - Throw descriptive error if context is used outside provider
    - _Requirements: 1.2, 1.3, 1.4, 2.3, 7.2_

  - [x] 1.2 Write property tests for ChatContext
    - **Property 1: Chat bubble visibility is inverse of modal state**
    - **Validates: Requirements 1.3, 1.4**
    - **Property 2: Unread count tracks messages received while modal is closed**
    - **Validates: Requirements 1.6**
    - **Property 3: Agent selection updates active agent**
    - **Validates: Requirements 2.3**
    - Test file: `frontend/src/__tests__/chat-context.property.spec.ts`

  - [x] 1.3 Add spinning border CSS animation to `frontend/src/index.css`
    - Add `@keyframes spin-border` using a rotating conic-gradient
    - Add `--animate-spin-border` to the `@theme` block
    - _Requirements: 6.5_

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement backend ticket deletion
  - [x] 3.1 Add `delete(id: string)` method to `backend/src/tickets/tickets.service.ts`
    - Find ticket by ID, throw `NotFoundException` if not found
    - Remove ticket via `ticketRepo.remove()`
    - Emit `ticket.deleted` event via `EventEmitter2`
    - _Requirements: 4.6_

  - [x] 3.2 Add `DELETE /tickets/:id` endpoint to `backend/src/tickets/tickets.controller.ts`
    - Add `@Delete('tickets/:id')` method with `@HttpCode(204)`
    - Call `ticketsService.delete(id)`
    - Import `Delete` and `HttpCode` from `@nestjs/common`
    - _Requirements: 4.3, 4.6_

  - [x] 3.3 Write property test for backend ticket deletion
    - **Property 7: Backend ticket deletion removes ticket and comments**
    - **Validates: Requirements 4.6**
    - Test file: `backend/src/tickets/__tests__/delete.property.spec.ts`

- [x] 4. Implement new frontend components
  - [x] 4.1 Create `AgentSelectorDropdown` at `frontend/src/features/chat/AgentSelectorDropdown.tsx`
    - Props: `{ value: AgentType; onChange: (agent: AgentType) => void }`
    - Custom dropdown listing PM, Developer, Tester with `getAvatarSrc()` avatars and display names
    - Visually indicate the currently selected agent
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 4.2 Create `ChatModal` at `frontend/src/features/chat/ChatModal.tsx`
    - Portal to `document.body`, render backdrop + centered panel (max-w-[640px], max-h-[80vh])
    - Use `useChatContext` for `isOpen`, `selectedAgent`, `closeChat`, `markRead`
    - Include `AgentSelectorDropdown` in header
    - Reuse `useChatMessages` and `useSendChatMessage` hooks from existing `ChatPanel`
    - Message list with distinct user/agent bubble styling; agent messages show `Agent_Avatar` via `getAvatarSrc()`
    - Input area with image attachment button, text input, and send button
    - Send button shows loading indicator and is disabled while `sendMessage.isPending`
    - Close on backdrop click or close button; call `markRead()` on open
    - Rounded corners, subtle shadow, semi-transparent backdrop
    - _Requirements: 1.2, 1.4, 2.1, 2.3, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 4.3 Write property tests for chat message avatar and send button
    - **Property 12: Agent messages render with avatar, user messages without**
    - **Validates: Requirements 9.2**
    - Test file: `frontend/src/__tests__/chat-message-avatar.property.spec.ts`
    - **Property 13: Send button disabled while message is pending**
    - **Validates: Requirements 9.5**
    - Test file: `frontend/src/__tests__/chat-send-button.property.spec.ts`

  - [x] 4.4 Create `ChatBubble` at `frontend/src/features/chat/ChatBubble.tsx`
    - Fixed-position circular button, bottom-right corner, `z-40`
    - Chat icon (e.g., `FiMessageCircle` from react-icons)
    - Show unread badge (red dot with count) when `unreadCount > 0`
    - Hidden when `isOpen` is `true` (from ChatContext)
    - On click: call `openChat()`
    - _Requirements: 1.1, 1.3, 1.6_

  - [x] 4.5 Create `AuditToolbar` at `frontend/src/features/board/AuditToolbar.tsx`
    - Props: `{ spaceId: string }`
    - Horizontal bar at bottom of BoardPage, collapsible via close button
    - Subscribe to WebSocket events: `execution_action`, `pipeline_completed`, `ticket_created`, `ticket_updated`
    - Maintain internal event array (capped at 200), prepend new events (newest first)
    - Each event row: formatted timestamp, event type icon, summary text
    - Max height with `overflow-y-auto` for scrolling
    - When closed, show a small toggle button to reopen
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 4.6 Write property tests for AuditToolbar
    - **Property 4: Audit events maintain reverse-chronological order**
    - **Validates: Requirements 3.2, 3.3**
    - **Property 5: Audit event rendering includes required fields**
    - **Validates: Requirements 3.4**
    - Test file: `frontend/src/__tests__/audit-toolbar.property.spec.ts`

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add `useDeleteTicket` hook and modify existing components
  - [x] 6.1 Add `useDeleteTicket` mutation hook to `frontend/src/api/hooks/useTickets.ts`
    - Mutation: `DELETE /tickets/:id`
    - On success: invalidate `['tickets', spaceId]` query
    - _Requirements: 4.3, 4.4_

  - [x] 6.2 Write property test for ticket deletion
    - **Property 6: Ticket deletion removes ticket from board state**
    - **Validates: Requirements 4.4**
    - Test file: `frontend/src/__tests__/ticket-delete.property.spec.ts`

  - [x] 6.3 Modify `TicketCard` in `frontend/src/features/board/TicketCard.tsx`
    - Accept new props: `agents: Agent[]`, `onDelete: (ticketId: string) => void`, `activeTicketId: string | null`
    - Add `opacity-0` class when card's ticket ID matches `activeTicketId` (hide original during drag)
    - Display assigned agent's avatar when `ticket.assigneeAgentId` is non-null (resolve agent from `agents` prop)
    - Apply spinning border CSS class when assigned agent's status is `"active"`
    - Add delete button (visible on hover) with `window.confirm()` confirmation dialog
    - On confirmed delete: call `onDelete(ticket.id)`
    - _Requirements: 4.1, 4.2, 5.1, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 6.4 Write property tests for TicketCard drag ghost and agent display
    - **Property 8: Original card hidden during drag**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - Test file: `frontend/src/__tests__/drag-ghost.property.spec.ts`
    - **Property 9: Agent avatar presence matches assignment**
    - **Validates: Requirements 6.1, 6.2**
    - **Property 10: Spinning border matches agent active status**
    - **Validates: Requirements 6.3, 6.4**
    - Test file: `frontend/src/__tests__/ticket-card-agent.property.spec.ts`

  - [x] 6.5 Modify `BoardColumn` in `frontend/src/features/board/BoardColumn.tsx`
    - Accept and forward new props: `activeTicketId`, `agents`, `onDelete`
    - Pass these props to each `TicketCard` child
    - _Requirements: 5.1, 6.1_

  - [x] 6.6 Modify `KanbanBoard` in `frontend/src/features/board/KanbanBoard.tsx`
    - Fetch agents via `useAgents(spaceId)` hook
    - Instantiate `useDeleteTicket` hook
    - Pass `activeTicketId` (from `activeTicket?.id`), `agents`, and `onDelete` handler to each `BoardColumn`
    - _Requirements: 4.4, 5.1, 6.1_

- [x] 7. Modify AgentInspector and PipelineSettings
  - [x] 7.1 Modify `AgentInspector` in `frontend/src/features/agents/AgentInspector.tsx`
    - Import and use `useChatContext`
    - Add "Chat with [Agent Name]" button in the header area
    - On click: call `openChat(agent.agentType)` then call `onClose()`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 7.2 Write property test for inspector chat button
    - **Property 11: Inspector chat button opens modal with correct agent**
    - **Validates: Requirements 7.1, 7.2**
    - Test file: `frontend/src/__tests__/inspector-chat.property.spec.ts`

  - [x] 7.3 Fix `PipelineSettings` in `frontend/src/features/pipeline/PipelineSettings.tsx`
    - Add `shrink-0` to toggle button to prevent compression
    - Ensure row uses `items-center` properly for alignment
    - Adjust toggle knob `left` offset (use `left-0.5` / `left-[22px]`) to prevent clipping
    - Ensure consistent padding and border-radius on stage cards
    - Ensure modal is vertically centered and does not overflow on 1024px+ viewports
    - Align close button to top-right corner of modal header
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 8. Wire everything together in BoardPage
  - [x] 8.1 Modify `BoardPage` in `frontend/src/features/board/BoardPage.tsx`
    - Wrap content with `<ChatProvider>`
    - Remove the fixed `<ChatPanel>` section and its `h-80` container div
    - Add `<ChatBubble />` component
    - Add `<ChatModal />` component
    - Add `<AuditToolbar spaceId={spaceId} />` between KanbanBoard and bottom
    - _Requirements: 1.1, 1.5, 3.1_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses TypeScript throughout: React 19 + Vite + Tailwind CSS v4 (frontend), NestJS + TypeORM (backend)
- fast-check v4.6.0 is already installed in both frontend (vitest) and backend (jest)
