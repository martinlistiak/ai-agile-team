import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TokenEncryptionService } from "./token-encryption.service";
import { FileStorageService } from "./file-storage.service";
import { FilesController } from "./files.controller";
import { CountlyService } from "./countly.service";
import { SubscriptionActiveGuard } from "./subscription-active.guard";
import { TurnstileService } from "./turnstile.service";
import { AgentRunQuotaService } from "./agent-run-quota.service";
import { AccessControlService } from "./access-control.service";
import { TeamMember } from "../entities/team-member.entity";
import { Execution } from "../entities/execution.entity";
import { Agent } from "../entities/agent.entity";
import { Space } from "../entities/space.entity";
import { User } from "../entities/user.entity";
import { Ticket } from "../entities/ticket.entity";
import { Rule } from "../entities/rule.entity";
import { SuggestedRule } from "../entities/suggested-rule.entity";
import { ChatAttachment } from "../entities/chat-attachment.entity";
import { Team } from "../entities/team.entity";
import { AgentTraining } from "../entities/agent-training.entity";

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Team,
      TeamMember,
      Execution,
      Agent,
      AgentTraining,
      Space,
      Ticket,
      Rule,
      SuggestedRule,
      ChatAttachment,
      User,
    ]),
  ],
  controllers: [FilesController],
  providers: [
    TokenEncryptionService,
    FileStorageService,
    CountlyService,
    SubscriptionActiveGuard,
    TurnstileService,
    AgentRunQuotaService,
    AccessControlService,
  ],
  exports: [
    TypeOrmModule,
    TokenEncryptionService,
    FileStorageService,
    CountlyService,
    SubscriptionActiveGuard,
    TurnstileService,
    AgentRunQuotaService,
    AccessControlService,
  ],
})
export class CommonModule {}
