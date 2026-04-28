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
import { Request } from "express";
import { JwtOrApiKeyGuard } from "../auth/jwt-or-apikey.guard";
import { SubscriptionActiveGuard } from "../common/subscription-active.guard";
import { CountlyService } from "../common/countly.service";
import { Throttle } from "@nestjs/throttler";
import { TicketsService } from "./tickets.service";
import { AgentsService } from "../agents/agents.service";
import { GithubService } from "../agents/github.service";
import { GitlabService } from "../agents/gitlab.service";
import {
  PipelineService,
  AGENT_DEFAULT_STATUS,
} from "../pipeline/pipeline.service";
import { TriggerAgentDto } from "./dto/trigger-agent.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import { MoveTicketDto } from "./dto/move-ticket.dto";
import { BulkDeleteTicketsDto } from "./dto/bulk-delete-tickets.dto";
import { AccessControlService } from "../common/access-control.service";

@ApiTags("Tickets")
@ApiBearerAuth("bearer")
@Controller()
@UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard)
export class TicketsController {
  constructor(
    private ticketsService: TicketsService,
    private agentsService: AgentsService,
    private githubService: GithubService,
    private gitlabService: GitlabService,
    @Inject(forwardRef(() => PipelineService))
    private pipelineService: PipelineService,
    private countly: CountlyService,
    private accessControl: AccessControlService,
  ) {}

  @Get("spaces/:spaceId/tickets")
  @ApiOperation({ summary: "List all tickets in a space" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Array of tickets" })
  async findBySpace(@Req() req: Request, @Param("spaceId") spaceId: string) {
    await this.accessControl.getAccessibleSpaceOrThrow(spaceId, (req.user as any).id);
    return this.ticketsService.findBySpace(spaceId);
  }

  @Post("spaces/:spaceId/tickets")
  @ApiOperation({ summary: "Create a new ticket" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 201, description: "Created ticket" })
  async create(
    @Req() req: Request,
    @Param("spaceId") spaceId: string,
    @Body() body: CreateTicketDto,
  ) {
    await this.accessControl.getAccessibleSpaceOrThrow(spaceId, (req.user as any).id);
    const ticket = await this.ticketsService.create({ spaceId, ...body });
    const userId = (req.user as { id?: string })?.id;
    if (userId) {
      this.countly.record(userId, "ticket_created", { source: "api" });
    }
    return ticket;
  }

  @Get("tickets/:id")
  @ApiOperation({ summary: "Get a single ticket with comments" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Ticket object with comments" })
  async findOne(@Req() req: Request, @Param("id") id: string) {
    return this.accessControl.getAccessibleTicketOrThrow(id, (req.user as any).id);
  }

  @Patch("tickets/:id")
  @ApiOperation({ summary: "Update ticket fields" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Updated ticket" })
  async update(
    @Param("id") id: string,
    @Body() body: UpdateTicketDto,
    @Req() req: any,
  ) {
    const ticket = await this.accessControl.getAccessibleTicketOrThrow(id, req.user.id);
    if (body.assigneeAgentId) {
      await this.accessControl.assertAgentInSpace(body.assigneeAgentId, ticket.spaceId);
    }
    if (body.assigneeUserId) {
      const space = await this.accessControl.getAccessibleSpaceOrThrow(
        ticket.spaceId,
        req.user.id,
      );
      await this.accessControl.assertUserCanBeAssignedToOwnedSpace(
        space.userId,
        body.assigneeUserId,
      );
    }

    const { startWorking, ...updateData } = body;
    const actor = {
      id: req.user.id,
      name: req.user.name,
      type: "user" as const,
    };
    let updated = await this.ticketsService.update(id, updateData, actor);
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
          actor,
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
  async move(
    @Param("id") id: string,
    @Body() body: MoveTicketDto,
    @Req() req: any,
  ) {
    await this.accessControl.getAccessibleTicketOrThrow(id, req.user.id);
    const actor = {
      id: req.user.id,
      name: req.user.name,
      type: "user" as const,
    };
    return this.ticketsService.moveTicket(id, body.status, "user", actor);
  }

  @Patch("spaces/:spaceId/tickets/reorder")
  @ApiOperation({ summary: "Reorder tickets within a status column" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Tickets reordered" })
  async reorder(
    @Req() req: Request,
    @Param("spaceId") spaceId: string,
    @Body() body: { status: string; ticketIds: string[] },
  ) {
    await this.accessControl.getAccessibleSpaceOrThrow(spaceId, (req.user as any).id);
    await this.accessControl.assertTicketsInSpace(body.ticketIds, spaceId);
    await this.ticketsService.reorderTickets(
      spaceId,
      body.status,
      body.ticketIds,
    );
    return { success: true };
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
    await this.accessControl.getAccessibleTicketOrThrow(id, req.user.id);
    return this.ticketsService.addComment(
      id,
      body.content,
      "user",
      req.user.id,
      req.user.name,
    );
  }

  @Delete("tickets/:id")
  @HttpCode(204)
  @ApiOperation({ summary: "Delete a ticket" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 204, description: "Ticket deleted" })
  async remove(@Req() req: Request, @Param("id") id: string) {
    await this.accessControl.getAccessibleTicketOrThrow(id, (req.user as any).id);
    await this.ticketsService.delete(id);
  }

  @Post("spaces/:spaceId/tickets/bulk-delete")
  @HttpCode(200)
  @ApiOperation({ summary: "Delete multiple tickets at once" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Number of deleted tickets" })
  async bulkDelete(
    @Req() req: Request,
    @Param("spaceId") spaceId: string,
    @Body() body: BulkDeleteTicketsDto,
  ) {
    await this.accessControl.getAccessibleSpaceOrThrow(spaceId, (req.user as any).id);
    await this.accessControl.assertTicketsInSpace(body.ticketIds, spaceId);
    const deleted = await this.ticketsService.bulkDelete(body.ticketIds);
    return { deleted };
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
  async triggerAgent(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() _body: TriggerAgentDto,
  ) {
    await this.accessControl.getAccessibleTicketOrThrow(id, (req.user as any).id);
    return this.pipelineService.triggerAgentForTicket(id);
  }

  @Post("tickets/:id/merge-pr")
  @HttpCode(200)
  @ApiOperation({ summary: "Merge the PR/MR associated with a ticket" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "PR/MR merged" })
  async mergePr(@Req() req: Request, @Param("id") id: string) {
    const ticket = await this.accessControl.getAccessibleTicketOrThrow(
      id,
      (req.user as any).id,
    );
    if (!ticket.prUrl) {
      throw new Error("Ticket has no associated PR/MR");
    }

    const space = await this.ticketsService.getSpaceForTicket(id);

    if (space.gitlabRepoUrl && ticket.prUrl.includes("gitlab")) {
      await this.gitlabService.mergeMergeRequest(space.id, ticket.prUrl);
    } else if (space.githubRepoUrl) {
      await this.githubService.mergePullRequest(space.id, ticket.prUrl);
    } else {
      throw new Error("No connected repository for this space");
    }

    return { merged: true };
  }
}
