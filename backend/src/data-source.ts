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
  ],
  migrations: ["src/migrations/*.ts"],
  synchronize: false,
});
