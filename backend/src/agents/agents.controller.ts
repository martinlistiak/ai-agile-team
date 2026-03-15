import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { AgentsService } from "./agents.service";
import { DeveloperAgentService } from "./developer-agent.service";
import { TesterAgentService } from "./tester-agent.service";

@Controller()
@UseGuards(AuthGuard("jwt"))
export class AgentsController {
  constructor(
    private agentsService: AgentsService,
    private developerAgentService: DeveloperAgentService,
    private testerAgentService: TesterAgentService,
  ) {}

  @Get("spaces/:spaceId/agents")
  async findBySpace(@Param("spaceId") spaceId: string) {
    return this.agentsService.findBySpace(spaceId);
  }

  @Get("agents/:id")
  async findOne(@Param("id") id: string) {
    return this.agentsService.findById(id);
  }

  @Get("agents/:agentId/executions")
  async getExecutions(
    @Param("agentId") agentId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
    const limitNum = Math.max(
      1,
      Math.min(100, parseInt(limit ?? "20", 10) || 20),
    );
    return this.agentsService.getExecutionsByAgent(agentId, pageNum, limitNum);
  }

  @Patch("agents/:id/rules")
  async updateRules(@Param("id") id: string, @Body() body: { rules: string }) {
    return this.agentsService.updateRules(id, body.rules);
  }

  /**
   * Trigger the developer agent to work on a specific ticket.
   * This is the "play" button action from the kanban board.
   */
  @Post("spaces/:spaceId/agents/developer/run")
  async runDeveloper(
    @Param("spaceId") spaceId: string,
    @Body() body: { ticketId: string; instructions?: string },
  ) {
    const result = await this.developerAgentService.run(
      spaceId,
      body.instructions ?? "",
      body.ticketId,
    );
    return { result };
  }

  /**
   * Trigger the tester agent to test a specific ticket.
   */
  @Post("spaces/:spaceId/agents/tester/run")
  async runTester(
    @Param("spaceId") spaceId: string,
    @Body() body: { ticketId: string; instructions?: string },
  ) {
    const result = await this.testerAgentService.run(
      spaceId,
      body.instructions ?? "",
      body.ticketId,
    );
    return { result };
  }
}
