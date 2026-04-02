import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";
import { PmAgentService } from "./pm-agent.service";
import { DeveloperAgentService } from "./developer-agent.service";
import { TesterAgentService } from "./tester-agent.service";
import { ReviewerAgentService } from "./reviewer-agent.service";
import { CustomAgentService } from "./custom-agent.service";
import { GithubService } from "./github.service";
import { GitlabService } from "./gitlab.service";
import { Agent } from "../entities/agent.entity";
import { Ticket } from "../entities/ticket.entity";
import { Execution } from "../entities/execution.entity";
import { Space } from "../entities/space.entity";
import { User } from "../entities/user.entity";
import { TicketsModule } from "../tickets/tickets.module";
import { RulesModule } from "../rules/rules.module";
import { ChatModule } from "../chat/chat.module";

import { ExecutionRegistry } from "./execution-registry";
import { ModelRouterService } from "./model-router.service";
import { AgentMemoryService } from "./agent-memory.service";
import { AgentBoosterService } from "./agent-booster.service";
import { AgentCoordinatorService } from "./agent-coordinator.service";
import { AgentMemory } from "../entities/agent-memory.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Agent, Ticket, Execution, Space, User, AgentMemory]),
    forwardRef(() => TicketsModule),
    forwardRef(() => ChatModule),
    RulesModule,
  ],
  controllers: [AgentsController],
  providers: [
    AgentsService,
    PmAgentService,
    DeveloperAgentService,
    TesterAgentService,
    ReviewerAgentService,
    CustomAgentService,
    GithubService,
    GitlabService,
    ExecutionRegistry,
    ModelRouterService,
    AgentMemoryService,
    AgentBoosterService,
    AgentCoordinatorService,
  ],
  exports: [
    AgentsService,
    PmAgentService,
    DeveloperAgentService,
    TesterAgentService,
    ReviewerAgentService,
    CustomAgentService,
    GithubService,
    GitlabService,
    ExecutionRegistry,
    AgentCoordinatorService,
  ],
})
export class AgentsModule {}
