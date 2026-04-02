import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Space } from "../entities/space.entity";
import { Ticket } from "../entities/ticket.entity";
import { PmAgentService } from "../agents/pm-agent.service";
import { DeveloperAgentService } from "../agents/developer-agent.service";
import { TesterAgentService } from "../agents/tester-agent.service";
import { ReviewerAgentService } from "../agents/reviewer-agent.service";
import { SuggestedRulesService } from "../rules/suggested-rules.service";
import { AgentCoordinatorService } from "../agents/agent-coordinator.service";
import { EventsGateway } from "../chat/events.gateway";
import { CountlyService } from "../common/countly.service";

/**
 * Pipeline stages and the agent responsible for each transition:
 *
 * backlog  --[PM plans]--> planning
 * planning --[Dev implements]--> development --> review
 * review   --[manual or auto]--> testing
 * testing  --[Tester tests]--> staged (if pass) or development (if fail)
 * staged   --[manual]--> done
 */

export type PipelineStage =
  | "backlog"
  | "planning"
  | "development"
  | "review"
  | "testing"
  | "staged"
  | "done";

export const PIPELINE_STAGES: PipelineStage[] = [
  "backlog",
  "planning",
  "development",
  "review",
  "testing",
  "staged",
  "done",
];

export const STAGE_AGENT_MAP: Partial<
  Record<PipelineStage, "developer" | "tester" | "reviewer">
> = {
  development: "developer",
  review: "reviewer",
  testing: "tester",
};

/** Default column (status) where each agent type operates. Used when assigning a ticket to an agent and starting work. */
export const AGENT_DEFAULT_STATUS: Partial<
  Record<"pm" | "developer" | "tester" | "reviewer", PipelineStage>
> = {
  pm: "planning",
  developer: "development",
  reviewer: "review",
  tester: "testing",
};

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);
  private activeRuns = new Set<string>(); // ticketId set to prevent double-triggers

  constructor(
    @InjectRepository(Space) private spaceRepo: Repository<Space>,
    @InjectRepository(Ticket) private ticketRepo: Repository<Ticket>,
    private developerAgentService: DeveloperAgentService,
    private testerAgentService: TesterAgentService,
    private reviewerAgentService: ReviewerAgentService,
    private suggestedRulesService: SuggestedRulesService,
    private agentCoordinator: AgentCoordinatorService,
    private eventsGateway: EventsGateway,
    private countly: CountlyService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Called whenever a ticket status changes.
   * Checks if the pipeline should auto-trigger the next agent.
   */
  async onTicketStatusChange(ticket: Ticket): Promise<void> {
    if (this.activeRuns.has(ticket.id)) {
      return; // Already processing this ticket
    }

    const space = await this.spaceRepo.findOneBy({ id: ticket.spaceId });
    if (!space) return;

    const pipelineConfig = space.pipelineConfig || {};
    const status = ticket.status as PipelineStage;
    const targetAgent = STAGE_AGENT_MAP[status];

    // Only auto-trigger if the stage is enabled in pipeline config and has a mapped agent
    if (!targetAgent) return;
    if (status === "development" && !pipelineConfig.development) return;
    if (status === "review" && !pipelineConfig.review) return;
    if (status === "testing" && !pipelineConfig.testing) return;

    this.activeRuns.add(ticket.id);

    // Run async — don't block the status change
    this.runAgentForStage(ticket, targetAgent, space.id)
      .catch((error) =>
        this.logger.error(`Pipeline error for ticket ${ticket.id}:`, error),
      )
      .finally(() => this.activeRuns.delete(ticket.id));
  }

  private async runAgentForStage(
    ticket: Ticket,
    agentType: "developer" | "tester" | "reviewer",
    spaceId: string,
  ): Promise<void> {
    this.logger.log(
      `Pipeline auto-triggering ${agentType} for ticket ${ticket.id} (${ticket.title})`,
    );

    this.eventsGateway.emitPipelineEvent(spaceId, {
      ticketId: ticket.id,
      stage: ticket.status,
      agentType,
      action: "started",
    });

    try {
      // Build context from prior pipeline stages for this ticket
      const context = await this.agentCoordinator.buildContextForTicket(
        ticket.id,
      );
      const contextPrompt =
        this.agentCoordinator.formatContextForPrompt(context);

      let result: string;
      if (agentType === "developer") {
        result = await this.developerAgentService.run(
          spaceId,
          contextPrompt,
          ticket.id,
        );
      } else if (agentType === "reviewer") {
        result = await this.reviewerAgentService.run(
          spaceId,
          contextPrompt,
          ticket.id,
        );
      } else {
        result = await this.testerAgentService.run(
          spaceId,
          contextPrompt,
          ticket.id,
        );
      }

      // Check for review feedback loop (reviewer → developer auto-fix)
      if (agentType === "reviewer") {
        const feedbackPrompt =
          await this.agentCoordinator.checkReviewFeedbackLoop(
            ticket.id,
            result,
          );
        if (feedbackPrompt) {
          this.logger.log(
            `Review feedback loop triggered for ticket ${ticket.id} — auto-fixing`,
          );
          this.eventsGateway.emitPipelineEvent(spaceId, {
            ticketId: ticket.id,
            stage: "development",
            agentType: "developer",
            action: "started",
          });
          await this.developerAgentService.run(
            spaceId,
            feedbackPrompt,
            ticket.id,
          );
        }
      }

      this.eventsGateway.emitPipelineEvent(spaceId, {
        ticketId: ticket.id,
        stage: ticket.status,
        agentType,
        action: "completed",
        result: result.substring(0, 500),
      });

      // Trigger learning loop — analyze the latest execution for rule suggestions
      const updatedTicket = await this.ticketRepo.findOneBy({ id: ticket.id });
      if (updatedTicket) {
        this.eventsGateway.emitTicketUpdated(spaceId, updatedTicket);
      }

      // Emit pipeline_completed event so frontend can show progression prompts
      // Use the fresh ticket status from DB — agents may have already advanced the ticket
      const actualStatus = updatedTicket?.status ?? ticket.status;
      const currentStageIndex = PIPELINE_STAGES.indexOf(
        actualStatus as PipelineStage,
      );
      const nextStage =
        currentStageIndex < PIPELINE_STAGES.length - 1
          ? PIPELINE_STAGES[currentStageIndex + 1]
          : null;
      this.eventsGateway.emitPipelineCompleted(spaceId, {
        ticketId: ticket.id,
        completedStage: actualStatus,
        nextStage,
        agentType,
      });

      // Emit notification events for agent completion and stage change
      this.eventEmitter.emit("agent.execution.completed", {
        spaceId,
        agentType,
        agentName: agentType.charAt(0).toUpperCase() + agentType.slice(1),
        ticketId: ticket.id,
        ticketTitle: ticket.title,
        executionId: ticket.id, // best available reference
      });

      if (actualStatus !== ticket.status) {
        this.eventEmitter.emit("pipeline.stage.changed", {
          spaceId,
          ticketId: ticket.id,
          ticketTitle: ticket.title,
          fromStage: ticket.status,
          toStage: actualStatus,
        });
      }
    } catch (error: any) {
      this.eventsGateway.emitPipelineEvent(spaceId, {
        ticketId: ticket.id,
        stage: ticket.status,
        agentType,
        action: "failed",
        error: error.message,
      });

      // Emit notification event for agent failure
      this.eventEmitter.emit("agent.execution.failed", {
        spaceId,
        agentType,
        agentName: agentType.charAt(0).toUpperCase() + agentType.slice(1),
        ticketId: ticket.id,
        ticketTitle: ticket.title,
        executionId: ticket.id,
        error: error.message,
      });
    }
  }

  /**
   * Get the pipeline configuration for a space.
   */
  async getPipelineConfig(spaceId: string): Promise<Record<string, boolean>> {
    const space = await this.spaceRepo.findOneBy({ id: spaceId });
    return space?.pipelineConfig || {};
  }

  /**
   * Update which pipeline stages are enabled.
   */
  async updatePipelineConfig(
    spaceId: string,
    config: Record<string, boolean>,
  ): Promise<Record<string, boolean>> {
    await this.spaceRepo.update(spaceId, { pipelineConfig: config });
    const space = await this.spaceRepo.findOneBy({ id: spaceId });
    return space?.pipelineConfig || {};
  }

  /**
   * Manually trigger the appropriate agent for a ticket based on its current status.
   * Returns { queued: true, agentType } on success, or throws BadRequestException if no agent is mapped.
   * If the agent is already busy, queues the request and returns { queued: true }.
   */
  async triggerAgentForTicket(
    ticketId: string,
  ): Promise<{ queued: boolean; agentType?: string }> {
    const ticket = await this.ticketRepo.findOneBy({ id: ticketId });
    if (!ticket) {
      throw new BadRequestException("Ticket not found");
    }

    const status = ticket.status as PipelineStage;
    const agentType = STAGE_AGENT_MAP[status];

    if (!agentType) {
      throw new BadRequestException({
        error: "no_mapped_agent",
        message: `No agent mapped for status: ${status}`,
      });
    }

    // If agent is already busy with this ticket, queue the request
    if (this.activeRuns.has(ticketId)) {
      return { queued: true, agentType };
    }

    this.activeRuns.add(ticketId);

    // Run async — don't block the response
    this.runAgentForStage(ticket, agentType, ticket.spaceId)
      .catch((error) =>
        this.logger.error(`Trigger-agent error for ticket ${ticketId}:`, error),
      )
      .finally(() => this.activeRuns.delete(ticketId));

    return { queued: true, agentType };
  }

  /**
   * Find the next enabled stage after the given stage, based on pipeline config.
   * Returns null if there is no next enabled stage.
   */
  getNextEnabledStage(
    currentStage: PipelineStage,
    pipelineConfig: Record<string, boolean>,
  ): PipelineStage | null {
    const currentIndex = PIPELINE_STAGES.indexOf(currentStage);
    if (currentIndex === -1 || currentIndex >= PIPELINE_STAGES.length - 1) {
      return null;
    }

    for (let i = currentIndex + 1; i < PIPELINE_STAGES.length; i++) {
      const stage = PIPELINE_STAGES[i];
      // "backlog" and "done" are always considered enabled (terminal stages)
      if (stage === "done" || stage === "backlog") {
        return stage;
      }
      if (pipelineConfig[stage] !== false) {
        return stage;
      }
    }

    return null;
  }

  /**
   * Advance a ticket to the next enabled pipeline stage.
   * If the next stage has a mapped agent, triggers it.
   */
  async advanceTicket(ticketId: string): Promise<{
    ticketId: string;
    from: string;
    to: string;
    agentTriggered?: string;
  }> {
    const ticket = await this.ticketRepo.findOneBy({ id: ticketId });
    if (!ticket) {
      throw new BadRequestException("Ticket not found");
    }

    const space = await this.spaceRepo.findOneBy({ id: ticket.spaceId });
    if (!space) {
      throw new BadRequestException("Space not found");
    }

    const currentStage = ticket.status as PipelineStage;
    const nextStage = this.getNextEnabledStage(
      currentStage,
      space.pipelineConfig || {},
    );

    if (!nextStage) {
      throw new BadRequestException("Ticket is already at the final stage");
    }

    // Move the ticket
    const previousStatus = ticket.status;
    const statusHistory = [
      ...(ticket.statusHistory || []),
      {
        from: previousStatus,
        to: nextStage,
        timestamp: new Date().toISOString(),
        trigger: "pipeline" as const,
        actorType: "agent" as const,
        actorName: "Pipeline",
      },
    ];
    await this.ticketRepo.update(ticketId, {
      status: nextStage,
      statusHistory,
    });
    const updatedTicket = await this.ticketRepo.findOneBy({ id: ticketId });
    if (updatedTicket) {
      this.eventsGateway.emitTicketUpdated(space.id, updatedTicket);
    }

    const result: {
      ticketId: string;
      from: string;
      to: string;
      agentTriggered?: string;
    } = {
      ticketId,
      from: currentStage,
      to: nextStage,
    };

    // Emit pipeline stage change notification
    this.eventEmitter.emit("pipeline.stage.changed", {
      spaceId: space.id,
      ticketId,
      ticketTitle: updatedTicket?.title ?? ticket.title,
      fromStage: currentStage,
      toStage: nextStage,
    });

    // Trigger agent if the new stage has a mapped agent
    const agentType = STAGE_AGENT_MAP[nextStage];
    if (agentType && updatedTicket && !this.activeRuns.has(ticketId)) {
      result.agentTriggered = agentType;
      this.activeRuns.add(ticketId);
      this.runAgentForStage(updatedTicket, agentType, space.id)
        .catch((error) =>
          this.logger.error(
            `Advance-agent error for ticket ${ticketId}:`,
            error,
          ),
        )
        .finally(() => this.activeRuns.delete(ticketId));
    }

    return result;
  }

  /**
   * Run the full pipeline: sequentially advance through all remaining enabled stages.
   * Triggers agents at each stage that has a mapped agent, waiting for each to complete.
   */
  async runPipeline(ticketId: string): Promise<{
    ticketId: string;
    from: string;
    to: string;
    stagesAdvanced: string[];
  }> {
    const ticket = await this.ticketRepo.findOneBy({ id: ticketId });
    if (!ticket) {
      throw new BadRequestException("Ticket not found");
    }

    const space = await this.spaceRepo.findOneBy({ id: ticket.spaceId });
    if (!space) {
      throw new BadRequestException("Space not found");
    }

    const startStage = ticket.status as PipelineStage;
    this.countly.record(space.userId, "pipeline_run_started", {
      start_stage: String(startStage),
    });
    const stagesAdvanced: string[] = [];
    let currentStage = startStage;

    while (true) {
      const nextStage = this.getNextEnabledStage(
        currentStage,
        space.pipelineConfig || {},
      );
      if (!nextStage) break;

      // Move the ticket to the next stage
      const currentTicket = await this.ticketRepo.findOneBy({ id: ticketId });
      const prevStatus = currentTicket?.status || currentStage;
      const updatedHistory = [
        ...(currentTicket?.statusHistory || []),
        {
          from: prevStatus,
          to: nextStage,
          timestamp: new Date().toISOString(),
          trigger: "pipeline" as const,
          actorType: "agent" as const,
          actorName: "Pipeline",
        },
      ];
      await this.ticketRepo.update(ticketId, {
        status: nextStage,
        statusHistory: updatedHistory,
      });
      const updatedTicket = await this.ticketRepo.findOneBy({ id: ticketId });
      if (updatedTicket) {
        this.eventsGateway.emitTicketUpdated(space.id, updatedTicket);
      }

      stagesAdvanced.push(nextStage);

      // If the stage has a mapped agent, run it and wait for completion
      const agentType = STAGE_AGENT_MAP[nextStage];
      if (agentType && updatedTicket) {
        try {
          this.activeRuns.add(ticketId);
          await this.runAgentForStage(updatedTicket, agentType, space.id);
        } catch (error) {
          this.logger.error(
            `Pipeline run error at stage ${nextStage} for ticket ${ticketId}:`,
            error,
          );
          break;
        } finally {
          this.activeRuns.delete(ticketId);
        }
      }

      currentStage = nextStage;

      // Don't advance past "done"
      if (nextStage === "done") break;
    }

    return {
      ticketId,
      from: startStage,
      to: currentStage,
      stagesAdvanced,
    };
  }
}
