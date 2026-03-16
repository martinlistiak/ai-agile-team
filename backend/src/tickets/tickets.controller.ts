import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  Inject,
  Req,
  forwardRef,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { JwtOrApiKeyGuard } from "../auth/jwt-or-apikey.guard";
import { Throttle } from "@nestjs/throttler";
import { TicketsService } from "./tickets.service";
import { AgentsService } from "../agents/agents.service";
import {
  PipelineService,
  AGENT_DEFAULT_STATUS,
} from "../pipeline/pipeline.service";
import { TriggerAgentDto } from "./dto/trigger-agent.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import { MoveTicketDto } from "./dto/move-ticket.dto";

@ApiTags("Tickets")
@ApiBearerAuth("bearer")
@Controller()
@UseGuards(JwtOrApiKeyGuard)
export class TicketsController {
  constructor(
    private ticketsService: TicketsService,
    private agentsService: AgentsService,
    @Inject(forwardRef(() => PipelineService))
    private pipelineService: PipelineService,
  ) {}

  @Get("spaces/:spaceId/tickets")
  @ApiOperation({ summary: "List all tickets in a space" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Array of tickets" })
  async findBySpace(@Param("spaceId") spaceId: string) {
    return this.ticketsService.findBySpace(spaceId);
  }

  @Post("spaces/:spaceId/tickets")
  @ApiOperation({ summary: "Create a new ticket" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 201, description: "Created ticket" })
  async create(
    @Param("spaceId") spaceId: string,
    @Body() body: CreateTicketDto,
  ) {
    return this.ticketsService.create({ spaceId, ...body });
  }

  @Get("tickets/:id")
  @ApiOperation({ summary: "Get a single ticket with comments" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Ticket object with comments" })
  async findOne(@Param("id") id: string) {
    return this.ticketsService.findById(id);
  }

  @Patch("tickets/:id")
  @ApiOperation({ summary: "Update ticket fields" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Updated ticket" })
  async update(@Param("id") id: string, @Body() body: UpdateTicketDto) {
    const { startWorking, ...updateData } = body;
    let updated = await this.ticketsService.update(id, updateData);
    if (startWorking && body.assigneeAgentId) {
      const agent = await this.agentsService.findById(body.assigneeAgentId);
      const defaultStatus =
        agent &&
        AGENT_DEFAULT_STATUS[
          agent.agentType as keyof typeof AGENT_DEFAULT_STATUS
        ];
      if (defaultStatus) {
        updated = await this.ticketsService.moveTicket(
          updated.id,
          defaultStatus,
          "user",
        );
        await this.pipelineService.triggerAgentForTicket(updated.id);
      }
    }
    return updated;
  }

  @Patch("tickets/:id/move")
  @ApiOperation({ summary: "Move a ticket to a different status column" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Moved ticket" })
  async move(@Param("id") id: string, @Body() body: MoveTicketDto) {
    return this.ticketsService.moveTicket(id, body.status, "user");
  }

  @Post("tickets/:id/comments")
  @ApiOperation({ summary: "Add a comment to a ticket" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 201, description: "Updated ticket with new comment" })
  async addComment(
    @Param("id") id: string,
    @Body() body: CreateCommentDto,
    @Req() req: any,
  ) {
    return this.ticketsService.addComment(
      id,
      body.content,
      "user",
      req.user.id,
    );
  }

  @Delete("tickets/:id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete a ticket" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 204, description: "Ticket deleted" })
  async remove(@Param("id") id: string) {
    await this.ticketsService.delete(id);
  }

  @Post("tickets/:id/trigger-agent")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({
    summary: "Trigger the assigned agent to work on this ticket",
  })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Agent triggered" })
  @ApiResponse({ status: 429, description: "Rate limited (10 req/min)" })
  async triggerAgent(@Param("id") id: string, @Body() _body: TriggerAgentDto) {
    return this.pipelineService.triggerAgentForTicket(id);
  }
}
