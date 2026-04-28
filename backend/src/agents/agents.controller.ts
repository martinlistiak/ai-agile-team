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
import { AccessControlService } from "../common/access-control.service";

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
    private accessControl: AccessControlService,
  ) {}

  @Get("spaces/:spaceId/agents")
  @ApiOperation({ summary: "List all agents in a space" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Array of agents" })
  async findBySpace(@Req() req: Request, @Param("spaceId") spaceId: string) {
    await this.accessControl.getAccessibleSpaceOrThrow(spaceId, (req.user as any).id);
    return this.agentsService.findBySpace(spaceId);
  }

  @Get("agents/:id")
  @ApiOperation({ summary: "Get agent details" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Agent object" })
  async findOne(@Req() req: Request, @Param("id") id: string) {
    return this.accessControl.getAccessibleAgentOrThrow(id, (req.user as any).id);
  }

  @Get("agents/:agentId/executions")
  @ApiOperation({ summary: "List execution history for an agent" })
  @ApiParam({ name: "agentId", format: "uuid" })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: "Paginated execution list" })
  async getExecutions(
    @Req() req: Request,
    @Param("agentId") agentId: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    await this.accessControl.getAccessibleAgentOrThrow(agentId, (req.user as any).id);
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
  async updateRules(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { rules: string },
  ) {
    await this.accessControl.getAccessibleAgentOrThrow(id, (req.user as any).id);
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
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { systemPrompt: string },
  ) {
    await this.accessControl.getAccessibleAgentOrThrow(id, (req.user as any).id);
    return this.agentsService.updateSystemPrompt(id, body.systemPrompt);
  }

  @Post("agents/:id/stop")
  @ApiOperation({ summary: "Stop a running agent execution" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 201, description: "Stop result" })
  async stopAgent(@Req() req: Request, @Param("id") id: string) {
    await this.accessControl.getAccessibleAgentOrThrow(id, (req.user as any).id);
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
    @Req() req: Request,
    @Param("spaceId") spaceId: string,
    @Body() body: { ticketId: string; instructions?: string },
  ) {
    await this.accessControl.getAccessibleSpaceOrThrow(spaceId, (req.user as any).id);
    await this.accessControl.assertTicketInSpace(body.ticketId, spaceId);
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
    @Req() req: Request,
    @Param("spaceId") spaceId: string,
    @Body() body: { ticketId: string; instructions?: string },
  ) {
    await this.accessControl.getAccessibleSpaceOrThrow(spaceId, (req.user as any).id);
    await this.accessControl.assertTicketInSpace(body.ticketId, spaceId);
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
    await this.accessControl.getAccessibleSpaceOrThrow(spaceId, (req.user as any).id);
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
    @Req() req: Request,
    @Param("id") id: string,
    @Body()
    body: { name?: string; description?: string; systemPrompt?: string },
  ) {
    await this.accessControl.getAccessibleAgentOrThrow(id, (req.user as any).id);
    return this.agentsService.updateCustomAgent(id, body);
  }

  @Delete("agents/:id/custom")
  @UseGuards(PlanGuard)
  @RequirePlan("team", "enterprise")
  @ApiOperation({ summary: "Delete a custom agent" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Deletion result" })
  @ApiResponse({ status: 403, description: "Plan upgrade required" })
  async deleteCustomAgent(@Req() req: Request, @Param("id") id: string) {
    await this.accessControl.getAccessibleAgentOrThrow(id, (req.user as any).id);
    const deleted = await this.agentsService.deleteCustomAgent(id);
    return { deleted };
  }
}
