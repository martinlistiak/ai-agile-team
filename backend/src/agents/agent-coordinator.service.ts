import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Execution } from "../entities/execution.entity";
import { Ticket } from "../entities/ticket.entity";
import { TicketsService } from "../tickets/tickets.service";
import {
  isReviewerRequestChangesVerdict,
  isTesterRequestFixesVerdict,
} from "../common/review-verdict";

/**
 * Execution context passed between agents in a pipeline.
 * Contains summaries and artifacts from prior agent stages.
 */
export interface AgentContext {
  /** Ticket being worked on */
  ticketId: string;
  /** Summary from prior agent executions, ordered by stage */
  priorStages: {
    agentType: string;
    summary: string;
    modelUsed: string | null;
    tokensUsed: number;
    timestamp: string;
  }[];
  /** Total tokens spent across all stages for this ticket */
  totalTokensUsed: number;
}

/**
 * Coordinates multi-agent workflows with context passing between stages.
 *
 * Enhances the pipeline service by:
 * 1. Building context from prior executions to pass to the next agent
 * 2. Enabling review feedback loops (reviewer → developer re-implementation)
 * 3. Tracking cumulative token usage across the pipeline
 */
@Injectable()
export class AgentCoordinatorService {
  private readonly logger = new Logger(AgentCoordinatorService.name);

  constructor(
    @InjectRepository(Execution)
    private executionRepo: Repository<Execution>,
    private ticketsService: TicketsService,
  ) {}

  /**
   * Build context from all prior executions on a ticket.
   * This context string is prepended to the next agent's prompt
   * so it understands what previous agents did.
   */
  async buildContextForTicket(ticketId: string): Promise<AgentContext> {
    const executions = await this.executionRepo.find({
      where: { ticketId },
      relations: ["agent"],
      order: { startTime: "ASC" },
    });

    const priorStages = executions
      .filter(
        (e) =>
          e.status === "completed" || e.status === "completed_with_warnings",
      )
      .map((e) => {
        // Extract the final text from the action log
        const lastTextAction = [...(e.actionLog || [])]
          .reverse()
          .find((a: any) => a.result && typeof a.result === "string");

        return {
          agentType: e.agent?.agentType || "unknown",
          summary:
            lastTextAction?.result?.substring(0, 500) ||
            "Completed without detailed output.",
          modelUsed: e.modelUsed,
          tokensUsed: e.tokensUsed,
          timestamp: e.endTime?.toISOString() || e.startTime.toISOString(),
        };
      });

    const totalTokensUsed = priorStages.reduce(
      (sum, s) => sum + s.tokensUsed,
      0,
    );

    return { ticketId, priorStages, totalTokensUsed };
  }

  /**
   * Format context as a markdown section to prepend to agent prompts.
   */
  formatContextForPrompt(context: AgentContext): string {
    if (context.priorStages.length === 0) return "";

    const lines = context.priorStages.map(
      (s) =>
        `### ${s.agentType.charAt(0).toUpperCase() + s.agentType.slice(1)} Agent\n${s.summary}`,
    );

    return `# Context from Prior Pipeline Stages\n\n${lines.join("\n\n")}\n\n---\n\n`;
  }

  /**
   * Check if a review resulted in REQUEST_CHANGES and should trigger
   * an automatic re-implementation by the developer agent.
   *
   * Returns the review feedback if auto-fix should be triggered, null otherwise.
   */
  async checkReviewFeedbackLoop(
    ticketId: string,
    reviewResult: string,
  ): Promise<string | null> {
    if (!isReviewerRequestChangesVerdict(reviewResult)) {
      return null;
    }

    // Check how many review cycles we've had to prevent infinite loops
    const reviewExecutions = await this.executionRepo.find({
      where: { ticketId },
      relations: ["agent"],
    });

    const reviewCount = reviewExecutions.filter(
      (e) => e.agent?.agentType === "reviewer" && e.status === "completed",
    ).length;

    if (reviewCount >= 3) {
      this.logger.warn(
        `Ticket ${ticketId} has had ${reviewCount} review cycles — stopping auto-fix loop`,
      );
      await this.ticketsService.addComment(
        ticketId,
        "Auto-fix loop stopped after 3 review cycles. Manual intervention required.",
        "system",
        "system",
        "System",
      );
      return null;
    }

    try {
      await this.ticketsService.update(ticketId, {
        requestedChanges: true,
        requestedChangesFeedback: reviewResult,
        requestedChangesSource: "review",
      });
    } catch (err) {
      this.logger.warn(
        `Could not persist requestedChanges on ticket ${ticketId} (migration applied?): ${err}`,
      );
    }

    // Extract the actionable feedback for the developer
    return `The reviewer requested changes on your previous implementation. Here is the review feedback:\n\n${reviewResult}\n\nPlease address the reviewer's comments and push updated changes to the same branch.`;
  }

  /**
   * When testing reports REQUEST_FIXES, flag the ticket and optionally trigger
   * the same developer remediation loop as code review.
   */
  async checkTesterFeedbackLoop(
    ticketId: string,
    testResult: string,
  ): Promise<string | null> {
    if (!isTesterRequestFixesVerdict(testResult)) {
      return null;
    }

    const executions = await this.executionRepo.find({
      where: { ticketId },
      relations: ["agent"],
    });

    const testerCount = executions.filter(
      (e) => e.agent?.agentType === "tester" && e.status === "completed",
    ).length;

    if (testerCount >= 3) {
      this.logger.warn(
        `Ticket ${ticketId} has had ${testerCount} tester cycles — stopping auto-fix loop`,
      );
      await this.ticketsService.addComment(
        ticketId,
        "Auto-fix loop stopped after 3 testing cycles. Manual intervention required.",
        "system",
        "system",
        "System",
      );
      return null;
    }

    try {
      await this.ticketsService.update(ticketId, {
        requestedChanges: true,
        requestedChangesFeedback: testResult,
        requestedChangesSource: "testing",
      });
    } catch (err) {
      this.logger.warn(
        `Could not persist requestedChanges on ticket ${ticketId} (migration applied?): ${err}`,
      );
    }

    return `Testing reported that fixes are needed before staging. Here is the tester report:\n\n${testResult}\n\nPlease address the issues and push updated changes to the same branch.`;
  }
}
