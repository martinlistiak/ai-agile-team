import { Injectable, Logger } from "@nestjs/common";
import {
  AgentType,
  ModelTier,
  getModelForTier,
  getModelForAgent,
} from "./agent-models.config";

/**
 * Heuristic-based complexity signals used to classify task tier.
 */
interface ComplexitySignals {
  messageLength: number;
  hasHighComplexityKeywords: boolean;
  hasLowComplexityKeywords: boolean;
  agentType: AgentType;
  hasTicket: boolean;
}

// Keywords that suggest a task needs a more powerful model
const HIGH_COMPLEXITY_KEYWORDS = [
  "refactor",
  "architect",
  "redesign",
  "security audit",
  "migration",
  "performance optimization",
  "multi-file",
  "cross-cutting",
  "breaking change",
  "complex",
  "critical",
  "overhaul",
  "rewrite",
  "infrastructure",
  "database schema",
  "authentication",
  "authorization",
  "encryption",
  "concurrency",
  "race condition",
  "memory leak",
  "scalability",
];

// Keywords that suggest a simple task suitable for a cheaper model
const LOW_COMPLEXITY_KEYWORDS = [
  "list",
  "show",
  "status",
  "what is",
  "explain",
  "describe",
  "rename",
  "typo",
  "fix typo",
  "update text",
  "change label",
  "add comment",
  "formatting",
  "lint",
  "simple",
  "quick",
  "minor",
  "small change",
  "update readme",
  "bump version",
];

@Injectable()
export class ModelRouterService {
  private readonly logger = new Logger(ModelRouterService.name);

  /**
   * Determine the optimal model tier for a given task.
   *
   * Returns the resolved model string and the tier that was selected.
   * If the agent has a pinned model (via AGENT_MODELS config or env var
   * that differs from the default), the pinned model takes precedence.
   */
  routeModel(
    agentType: AgentType,
    userMessage: string,
    options?: { ticketId?: string; ticketPriority?: string; envModel?: string },
  ): { model: string; tier: ModelTier } {
    // Check if this agent has a pinned model override
    const pinnedModel = getModelForAgent(agentType, options?.envModel);
    const defaultTier2 = getModelForTier(2);
    const isPinned = pinnedModel !== defaultTier2;

    if (isPinned) {
      // Agent has a specific model configured — respect it
      this.logger.debug(
        `Agent ${agentType} has pinned model ${pinnedModel}, skipping routing`,
      );
      return { model: pinnedModel, tier: 2 };
    }

    const signals = this.analyzeComplexity(agentType, userMessage, options);
    const tier = this.classifyTier(signals, options?.ticketPriority);
    const model = getModelForTier(tier);

    this.logger.log(
      `Routed ${agentType} agent to tier ${tier} (${model}) — ` +
        `msgLen=${signals.messageLength}, ` +
        `highKw=${signals.hasHighComplexityKeywords}, ` +
        `lowKw=${signals.hasLowComplexityKeywords}`,
    );

    return { model, tier };
  }

  private analyzeComplexity(
    agentType: AgentType,
    userMessage: string,
    options?: { ticketId?: string },
  ): ComplexitySignals {
    const lowerMessage = userMessage.toLowerCase();

    return {
      messageLength: userMessage.length,
      hasHighComplexityKeywords: HIGH_COMPLEXITY_KEYWORDS.some((kw) =>
        lowerMessage.includes(kw),
      ),
      hasLowComplexityKeywords: LOW_COMPLEXITY_KEYWORDS.some((kw) =>
        lowerMessage.includes(kw),
      ),
      agentType,
      hasTicket: !!options?.ticketId,
    };
  }

  private classifyTier(
    signals: ComplexitySignals,
    ticketPriority?: string,
  ): ModelTier {
    // Critical priority tickets always get Opus
    if (ticketPriority === "critical") {
      return 3;
    }

    // Developer agent: ticket-based work defaults to Sonnet, can escalate to Opus
    if (signals.agentType === "developer") {
      if (signals.hasHighComplexityKeywords || signals.messageLength > 2000) {
        return 3;
      }
      if (signals.hasTicket) {
        return 2; // Standard ticket implementation → Sonnet
      }
      if (signals.hasLowComplexityKeywords && signals.messageLength < 200) {
        return 1;
      }
      return 2;
    }

    // Reviewer agent: reviews benefit from stronger models for security/quality
    if (signals.agentType === "reviewer") {
      if (signals.hasHighComplexityKeywords) {
        return 3;
      }
      return 2; // Reviews generally need Sonnet minimum
    }

    // Tester agent: test writing generally needs Sonnet
    if (signals.agentType === "tester") {
      if (signals.hasHighComplexityKeywords) {
        return 3;
      }
      return 2;
    }

    // PM agent: ticket creation can often use Haiku for simple requests
    if (signals.agentType === "pm") {
      if (signals.hasHighComplexityKeywords || signals.messageLength > 1500) {
        return 3;
      }
      if (signals.hasLowComplexityKeywords && signals.messageLength < 300) {
        return 1;
      }
      return 2;
    }

    // Custom agent: general-purpose routing
    if (signals.hasHighComplexityKeywords || signals.messageLength > 2000) {
      return 3;
    }
    if (signals.hasLowComplexityKeywords && signals.messageLength < 300) {
      return 1;
    }

    return 2; // Default to Sonnet
  }
}
