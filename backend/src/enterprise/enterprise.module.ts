import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SsoConfig } from "../entities/sso-config.entity";
import { AgentTraining } from "../entities/agent-training.entity";
import { SlaConfig } from "../entities/sla-config.entity";
import { AnalyticsEvent } from "../entities/analytics-event.entity";
import { User } from "../entities/user.entity";
import { Team } from "../entities/team.entity";
import { TeamMember } from "../entities/team-member.entity";
import { Agent } from "../entities/agent.entity";
import { Execution } from "../entities/execution.entity";
import { Space } from "../entities/space.entity";
import { Ticket } from "../entities/ticket.entity";
import { SsoService } from "./sso.service";
import { AgentTrainingService } from "./agent-training.service";
import { SlaService } from "./sla.service";
import { AnalyticsService } from "./analytics.service";
import { EnterpriseController } from "./enterprise.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SsoConfig,
      AgentTraining,
      SlaConfig,
      AnalyticsEvent,
      User,
      Team,
      TeamMember,
      Agent,
      Execution,
      Space,
      Ticket,
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [EnterpriseController],
  providers: [SsoService, AgentTrainingService, SlaService, AnalyticsService],
  exports: [SsoService, AgentTrainingService, SlaService, AnalyticsService],
})
export class EnterpriseModule {}
