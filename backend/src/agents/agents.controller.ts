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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import { JwtOrApiKeyGuard } from "../auth/jwt-or-apikey.guard";
import { AgentsService } from "./agents.service";
import { DeveloperAgentService } from "./developer-agent.service";
import { TesterAgentService } from "./tester-agent.service";

@ApiTags("Agents")
@ApiBearerAuth("bearer")
@Controller()
@UseGuards(JwtOrApiKeyGuard)
export class AgentsController {
  constructor(
    private agentsService: AgentsService,
    private developerAgentService: DeveloperAgentService,
    private testerAgentService: TesterAgentService,
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
}
