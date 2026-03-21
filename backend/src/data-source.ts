import { DataSource } from "typeorm";
import { User } from "./entities/user.entity";
import { Space } from "./entities/space.entity";
import { Agent } from "./entities/agent.entity";
import { Ticket } from "./entities/ticket.entity";
import { Execution } from "./entities/execution.entity";
import { ChatMessage } from "./entities/chat-message.entity";
import { ChatAttachment } from "./entities/chat-attachment.entity";
import { Rule } from "./entities/rule.entity";
import { SuggestedRule } from "./entities/suggested-rule.entity";
import { Team } from "./entities/team.entity";
import { TeamMember } from "./entities/team-member.entity";
import { TeamInvitation } from "./entities/team-invitation.entity";
import { PasswordResetToken } from "./entities/password-reset-token.entity";
import { EmailVerificationToken } from "./entities/email-verification-token.entity";
import { SsoConfig } from "./entities/sso-config.entity";
import { AgentTraining } from "./entities/agent-training.entity";
import { SlaConfig } from "./entities/sla-config.entity";
import { AnalyticsEvent } from "./entities/analytics-event.entity";
import { Notification } from "./entities/notification.entity";
import { NotificationPreference } from "./entities/notification-preference.entity";
import { ApiKey } from "./entities/api-key.entity";
import { OAuthClient } from "./entities/oauth-client.entity";
import { OAuthCode } from "./entities/oauth-code.entity";
import { OAuthToken } from "./entities/oauth-token.entity";

export default new DataSource({
  type: "postgres",
  host: process.env.DATABASE_HOST || "localhost",
  port: parseInt(process.env.DATABASE_PORT || "5432", 10),
  username: process.env.DATABASE_USER || "runa",
  password: process.env.DATABASE_PASSWORD || "runa",
  database: process.env.DATABASE_NAME || "runa",
  entities: [
    User,
    Space,
    Agent,
    Ticket,
    Execution,
    ChatMessage,
    ChatAttachment,
    Rule,
    SuggestedRule,
    Team,
    TeamMember,
    TeamInvitation,
    ApiKey,
    OAuthClient,
    OAuthCode,
    OAuthToken,
    PasswordResetToken,
    EmailVerificationToken,
    SsoConfig,
    AgentTraining,
    SlaConfig,
    AnalyticsEvent,
    Notification,
    NotificationPreference,
  ],
  // Must be relative to this file so CLI works from dist/ (production image has no src/)
  migrations: [__dirname + "/migrations/*{.ts,.js}"],
  synchronize: false,
});
