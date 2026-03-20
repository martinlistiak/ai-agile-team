export type TicketStatus =
  | "backlog"
  | "planning"
  | "development"
  | "review"
  | "testing"
  | "staged"
  | "done";
export type BuiltInAgentType = "pm" | "developer" | "tester" | "reviewer";
export type AgentType = BuiltInAgentType | "custom";
export type AgentStatus = "idle" | "active" | "error";
export type Priority = "low" | "medium" | "high" | "critical";

export type PlanTier = "starter" | "team" | "enterprise";
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "none";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  planTier: PlanTier;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd: string | null;
  hasGithub?: boolean;
  hasGitlab?: boolean;
  createdAt: string;
}

export interface Space {
  id: string;
  name: string;
  githubRepoUrl: string | null;
  gitlabRepoUrl: string | null;
  pipelineConfig: Record<string, boolean>;
  crossTeamRules: string | null;
  order: number;
  color: string | null;
  createdAt: string;
}

export interface GithubRepository {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  private: boolean;
  description: string | null;
  owner: string | null;
}

export interface GitlabRepository {
  id: number;
  name: string;
  fullName: string;
  htmlUrl: string;
  private: boolean;
  description: string | null;
  owner: string | null;
}

export interface Agent {
  id: string;
  spaceId: string;
  agentType: AgentType;
  name: string | null;
  description: string | null;
  systemPrompt: string | null;
  isCustom: boolean;
  rules: string | null;
  avatarRef: string;
  status: AgentStatus;
  createdAt: string;
}

export type TransitionTrigger = "user" | "agent" | "pipeline";

export interface StatusTransition {
  from: string;
  to: string;
  timestamp: string;
  trigger: TransitionTrigger;
}

export interface Ticket {
  id: string;
  spaceId: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  assigneeAgentId: string | null;
  assigneeUserId: string | null;
  comments: TicketComment[];
  statusHistory: StatusTransition[];
  prUrl: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssignableUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface TicketComment {
  id: string;
  authorType: "user" | "agent";
  authorId: string;
  content: string;
  createdAt: string;
}

export interface Execution {
  id: string;
  agentId: string;
  ticketId: string;
  startTime: string;
  endTime: string | null;
  status: "running" | "completed" | "failed";
  actionLog: Record<string, unknown>[];
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  agentType?: string;
  attachments: ChatAttachment[];
}

export interface ChatAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  isImage: boolean;
  url: string;
}

// WebSocket event payloads

export interface ExecutionActionPayload {
  executionId: string;
  agentId: string;
  tool: string;
  inputSummary: string;
  timestamp: string;
}

export interface PipelineCompletedPayload {
  ticketId: string;
  completedStage: string;
  nextStage: string | null;
  agentType: string;
}

export interface FileChangePayload {
  executionId: string;
  filePath: string;
  content: string;
  diff: { additions: number[]; deletions: number[] };
}

export interface BrowserScreenshotPayload {
  executionId: string;
  screenshot: string;
  timestamp: string;
}

export interface BrowserSessionEndPayload {
  executionId: string;
  timestamp: string;
}

export interface GithubPushPayload {
  spaceId: string;
  commitSha: string;
  commitMessage: string;
  author: string;
}

// Teams

export type TeamRole = "owner" | "admin" | "member";
export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  seatCount: number;
  createdAt: string;
}

export interface TeamMemberInfo {
  id: string;
  userId: string;
  role: TeamRole;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

export interface TeamDetail extends Team {
  members: TeamMemberInfo[];
  pendingInvitations: PendingInvitation[];
}

export interface InvitationInfo {
  id: string;
  email: string;
  status: InvitationStatus;
  expiresAt: string;
  team: { id: string; name: string };
  invitedBy: { name: string };
}
