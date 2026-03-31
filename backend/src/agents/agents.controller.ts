import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import { Request } from "express";
import { JwtOrApiKeyGuard } from "../auth/jwt-or-apikey.guard";
import { SubscriptionActiveGuard } from "../common/subscription-active.guard";
import { PlanGuard, RequirePlan } from "../billing/plan.guard";
import { CountlyService } from "../common/countly.service";
import { AgentsService } from "./agents.service";
import { DeveloperAgentService } from "./developer-agent.service";
import { TesterAgentService } from "./tester-agent.service";

@ApiTags("Agents")
@ApiBearerAuth("bearer")
@Controller()
@UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard)
export class AgentsController {
  constructor(
    private agentsService: AgentsService,
    private developerAgentService: DeveloperAgentService,
    private testerAgentService: TesterAgentService,
    private countly: CountlyService,
  ) {}

  @Get("spaces/:spaceId/agents")
  @ApiOperation({ summary: "List all agents in a space" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Array of agents" })
  async findBySpace(@Param("spaceId") spaceId: string) {
    return this.agentsService.findBySpace(spaceId);
  }

  @Get("agents/:id")
  @ApiOperation({ summary: "Get agent details" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Agent object" })
  async findOne(@Param("id") id: string) {
    return this.agentsService.findById(id);
  }

  @Get("agents/:agentId/executions")
  @ApiOperation({ summary: "List execution history for an agent" })
  @ApiParam({ name: "agentId", format: "uuid" })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: "Paginated execution list" })
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
  @ApiOperation({ summary: "Update the rules/instructions for an agent" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({
    schema: {
      type: "object",
      properties: { rules: { type: "string" } },
      required: ["rules"],
    },
  })
  @ApiResponse({ status: 200, description: "Updated agent" })
  async updateRules(@Param("id") id: string, @Body() body: { rules: string }) {
    return this.agentsService.updateRules(id, body.rules);
  }

  @Patch("agents/:id/system-prompt")
  @ApiOperation({ summary: "Update the system prompt for any agent" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({
    schema: {
      type: "object",
      properties: { systemPrompt: { type: "string" } },
      required: ["systemPrompt"],
    },
  })
  @ApiResponse({ status: 200, description: "Updated agent" })
  async updateSystemPrompt(
    @Param("id") id: string,
    @Body() body: { systemPrompt: string },
  ) {
    return this.agentsService.updateSystemPrompt(id, body.systemPrompt);
  }

  @Post("agents/:id/stop")
  @ApiOperation({ summary: "Stop a running agent execution" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 201, description: "Stop result" })
  async stopAgent(@Param("id") id: string) {
    return this.agentsService.stopExecution(id);
  }

  @Post("spaces/:spaceId/agents/developer/run")
  @ApiOperation({ summary: "Run the developer agent on a ticket" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        ticketId: { type: "string", format: "uuid" },
        instructions: { type: "string" },
      },
      required: ["ticketId"],
    },
  })
  @ApiResponse({ status: 201, description: "Agent execution result" })
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

  @Post("spaces/:spaceId/agents/tester/run")
  @ApiOperation({ summary: "Run the tester agent on a ticket" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        ticketId: { type: "string", format: "uuid" },
        instructions: { type: "string" },
      },
      required: ["ticketId"],
    },
  })
  @ApiResponse({ status: 201, description: "Agent execution result" })
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

  @Post("spaces/:spaceId/agents/custom")
  @UseGuards(PlanGuard)
  @RequirePlan("team", "enterprise")
  @ApiOperation({ summary: "Create a custom agent in a space" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        systemPrompt: { type: "string" },
      },
      required: ["name"],
    },
  })
  @ApiResponse({ status: 201, description: "Created custom agent" })
  @ApiResponse({ status: 403, description: "Plan upgrade required" })
  async createCustomAgent(
    @Req() req: Request,
    @Param("spaceId") spaceId: string,
    @Body() body: { name: string; description?: string; systemPrompt?: string },
  ) {
    const agent = await this.agentsService.createCustomAgent(spaceId, body);
    const userId = (req.user as { id?: string })?.id;
    if (userId) {
      this.countly.record(userId, "custom_agent_created", {});
    }
    return agent;
  }

  @Patch("agents/:id/custom")
  @UseGuards(PlanGuard)
  @RequirePlan("team", "enterprise")
  @ApiOperation({ summary: "Update a custom agent" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        systemPrompt: { type: "string" },
      },
    },
  })
  @ApiResponse({ status: 200, description: "Updated custom agent" })
  @ApiResponse({ status: 403, description: "Plan upgrade required" })
  async updateCustomAgent(
    @Param("id") id: string,
    @Body()
    body: { name?: string; description?: string; systemPrompt?: string },
  ) {
    return this.agentsService.updateCustomAgent(id, body);
  }

  @Delete("agents/:id/custom")
  @UseGuards(PlanGuard)
  @RequirePlan("team", "enterprise")
  @ApiOperation({ summary: "Delete a custom agent" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Deletion result" })
  @ApiResponse({ status: 403, description: "Plan upgrade required" })
  async deleteCustomAgent(@Param("id") id: string) {
    const deleted = await this.agentsService.deleteCustomAgent(id);
    return { deleted };
  }
}
