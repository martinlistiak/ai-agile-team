import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TokenEncryptionService } from "./token-encryption.service";
import { FileStorageService } from "./file-storage.service";
import { FilesController } from "./files.controller";
import { CountlyService } from "./countly.service";
import { SubscriptionActiveGuard } from "./subscription-active.guard";
import { TurnstileService } from "./turnstile.service";
import { AgentRunQuotaService } from "./agent-run-quota.service";
import { TeamMember } from "../entities/team-member.entity";
import { Execution } from "../entities/execution.entity";
import { Agent } from "../entities/agent.entity";
import { Space } from "../entities/space.entity";
import { User } from "../entities/user.entity";

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([TeamMember, Execution, Agent, Space, User]),
  ],
  controllers: [FilesController],
  providers: [
    TokenEncryptionService,
    FileStorageService,
    CountlyService,
    SubscriptionActiveGuard,
    TurnstileService,
    AgentRunQuotaService,
  ],
  exports: [
    TypeOrmModule,
    TokenEncryptionService,
    FileStorageService,
    CountlyService,
    SubscriptionActiveGuard,
    TurnstileService,
    AgentRunQuotaService,
  ],
})
export class CommonModule {}
