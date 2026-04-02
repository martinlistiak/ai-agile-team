import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ticket } from "../entities/ticket.entity";
import { Agent } from "../entities/agent.entity";
import { PipelineService, AGENT_DEFAULT_STATUS } from "./pipeline.service";
import { EventsGateway } from "../chat/events.gateway";
import { DeveloperAgentService } from "../agents/developer-agent.service";
import { TesterAgentService } from "../agents/tester-agent.service";
import { ReviewerAgentService } from "../agents/reviewer-agent.service";
import { PmAgentService } from "../agents/pm-agent.service";
import { AgentCoordinatorService } from "../agents/agent-coordinator.service";

@Injectable()
export class PipelineListener {
  private readonly logger = new Logger(PipelineListener.name);

  constructor(
    private pipelineService: PipelineService,
    private eventsGateway: EventsGateway,
    @InjectRepository(Ticket) private ticketRepo: Repository<Ticket>,
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
    private developerAgentService: DeveloperAgentService,
    private testerAgentService: TesterAgentService,
    private reviewerAgentService: ReviewerAgentService,
    private pmAgentService: PmAgentService,
    private agentCoordinator: AgentCoordinatorService,
  ) {}

  @OnEvent("ticket.created")
  handleTicketCreated(ticket: Ticket) {
    this.eventsGateway.emitTicketCreated(ticket.spaceId, ticket);
  }

  @OnEvent("ticket.updated")
  handleTicketUpdated(ticket: Ticket) {
    this.eventsGateway.emitTicketUpdated(ticket.spaceId, ticket);
  }

  @OnEvent("ticket.moved")
  handleTicketMoved(ticket: Ticket) {
    this.eventsGateway.emitTicketUpdated(ticket.spaceId, ticket);
    // Trigger pipeline orchestration
    this.pipelineService.onTicketStatusChange(ticket);
  }

  @OnEvent("suggested_rule.created")
  handleSuggestedRuleCreated(payload: { spaceId: string; suggestion: any }) {
    this.eventsGateway.emitSuggestedRule(payload.spaceId, payload.suggestion);
  }

  /**
   * Handle @mentions in ticket comments.
   * When a user mentions an agent (e.g. @developer), move the ticket to the
   * appropriate status and trigger the agent with the comment as context.
   */
  @OnEvent("ticket.comment.mentions")
  async handleCommentMentions(payload: {
    spaceId: string;
    ticketId: string;
    ticketTitle: string;
    content: string;
    mentions: string[];
    commenterId: string;
    commenterName: string;
  }) {
    const { spaceId, ticketId, content, mentions, commenterId, commenterName } =
      payload;

    for (const agentType of mentions) {
      try {
        // Find the agent for this type in the space
        const agent = await this.agentRepo.findOneBy({ spaceId, agentType });
        if (!agent) {
          this.logger.warn(`No ${agentType} agent found in space ${spaceId}`);
          continue;
        }

        // Get the default status for this agent type
        const targetStatus =
          AGENT_DEFAULT_STATUS[agentType as keyof typeof AGENT_DEFAULT_STATUS];
        if (!targetStatus) {
          this.logger.warn(
            `No default status mapped for agent type: ${agentType}`,
          );
          continue;
        }

        // Move ticket to the appropriate status
        const ticket = await this.ticketRepo.findOneBy({ id: ticketId });
        if (!ticket) continue;

        const previousStatus = ticket.status;
        if (previousStatus !== targetStatus) {
          const statusHistory = [
            ...(ticket.statusHistory || []),
            {
              from: previousStatus,
              to: targetStatus,
              timestamp: new Date().toISOString(),
              trigger: "mention" as const,
              actorId: commenterId,
              actorName: commenterName,
              actorType: "user" as const,
            },
          ];
          await this.ticketRepo.update(ticketId, {
            status: targetStatus,
            assigneeAgentId: agent.id,
            statusHistory,
          });

          const updatedTicket = await this.ticketRepo.findOneBy({
            id: ticketId,
          });
          if (updatedTicket) {
            this.eventsGateway.emitTicketUpdated(spaceId, updatedTicket);
          }
        }

        // Build context prompt including the comment
        const context =
          await this.agentCoordinator.buildContextForTicket(ticketId);
        const contextPrompt =
          this.agentCoordinator.formatContextForPrompt(context);
        const mentionPrompt = `${commenterName} mentioned you in a comment:\n\n"${content}"\n\n${contextPrompt}`;

        this.logger.log(
          `Triggering ${agentType} agent for ticket ${ticketId} via @mention`,
        );

        // Emit pipeline event for UI feedback
        this.eventsGateway.emitPipelineEvent(spaceId, {
          ticketId,
          stage: targetStatus,
          agentType,
          action: "started",
        });

        // Trigger the appropriate agent
        let result: string;
        switch (agentType) {
          case "developer":
            result = await this.developerAgentService.run(
              spaceId,
              mentionPrompt,
              ticketId,
            );
            break;
          case "tester":
            result = await this.testerAgentService.run(
              spaceId,
              mentionPrompt,
              ticketId,
            );
            break;
          case "reviewer":
            result = await this.reviewerAgentService.run(
              spaceId,
              mentionPrompt,
              ticketId,
            );
            break;
          case "pm":
            result = await this.pmAgentService.run(spaceId, mentionPrompt, []);
            break;
          default:
            this.logger.warn(`Unknown agent type for mention: ${agentType}`);
            continue;
        }

        this.eventsGateway.emitPipelineEvent(spaceId, {
          ticketId,
          stage: targetStatus,
          agentType,
          action: "completed",
          result: result.substring(0, 500),
        });
      } catch (error: any) {
        this.logger.error(
          `Failed to trigger ${agentType} agent via mention:`,
          error,
        );
        this.eventsGateway.emitPipelineEvent(spaceId, {
          ticketId,
          stage: "unknown",
          agentType,
          action: "failed",
          error: error.message,
        });
      }
    }
  }
}
