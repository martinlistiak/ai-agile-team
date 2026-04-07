import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { generateText } from "ai";
import { createMimoProvider } from "../agents/mimo-provider";
import { SuggestedRule } from "../entities/suggested-rule.entity";
import { Execution } from "../entities/execution.entity";
import { RulesService } from "./rules.service";

const SUGGESTION_PROMPT = `You are analyzing an AI agent's execution log to identify patterns that could be turned into reusable rules.

A "rule" is a short directive that guides the agent's future behavior. Good rules are:
- Specific and actionable (not vague)
- Derived from repeated patterns or corrections observed in executions
- About coding standards, architecture decisions, testing patterns, or workflow preferences

Analyze the execution log and current rules. If you identify 1-3 valuable new rules that aren't already covered, return them as JSON:
{
  "suggestions": [
    {
      "content": "the rule text",
      "reasoning": "why this rule would be valuable based on what you observed",
      "scope": "agent"
    }
  ]
}

If no new rules are warranted, return: { "suggestions": [] }

IMPORTANT: Only suggest rules that represent genuine patterns, not one-off decisions. The scope should be "agent" for agent-specific rules or "space" for project-wide rules.`;

@Injectable()
export class SuggestedRulesService {
  private readonly logger = new Logger(SuggestedRulesService.name);

  constructor(
    private configService: ConfigService,
    private rulesService: RulesService,
    private eventEmitter: EventEmitter2,
    @InjectRepository(SuggestedRule)
    private suggestedRuleRepo: Repository<SuggestedRule>,
    @InjectRepository(Execution) private executionRepo: Repository<Execution>,
  ) {}

  async findBySpace(spaceId: string): Promise<SuggestedRule[]> {
    return this.suggestedRuleRepo.find({
      where: { spaceId },
      order: { createdAt: "DESC" },
    });
  }

  async findPending(spaceId: string): Promise<SuggestedRule[]> {
    return this.suggestedRuleRepo.find({
      where: { spaceId, status: "pending" },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Accept a suggested rule — creates a real Rule from it.
   */
  async accept(suggestedRuleId: string): Promise<SuggestedRule> {
    const suggestion = await this.suggestedRuleRepo.findOneBy({
      id: suggestedRuleId,
    });
    if (!suggestion) throw new NotFoundException("Suggested rule not found");

    // Create actual rule
    await this.rulesService.create({
      spaceId: suggestion.spaceId,
      agentId: suggestion.agentId ?? undefined,
      scope: suggestion.suggestedScope,
      content: suggestion.content,
    });

    suggestion.status = "accepted";
    return this.suggestedRuleRepo.save(suggestion);
  }

  /**
   * Reject a suggested rule.
   */
  async reject(suggestedRuleId: string): Promise<SuggestedRule> {
    const suggestion = await this.suggestedRuleRepo.findOneBy({
      id: suggestedRuleId,
    });
    if (!suggestion) throw new NotFoundException("Suggested rule not found");
    suggestion.status = "rejected";
    return this.suggestedRuleRepo.save(suggestion);
  }

  /**
   * Create a rule suggestion directly from a code review finding.
   */
  async createFromReview(
    spaceId: string,
    agentId: string,
    executionId: string,
    content: string,
    reasoning: string,
  ): Promise<SuggestedRule> {
    const suggestion = this.suggestedRuleRepo.create({
      spaceId,
      agentId,
      executionId,
      content,
      reasoning,
      suggestedScope: "space",
      status: "pending",
    });
    const saved = await this.suggestedRuleRepo.save(suggestion);

    this.eventEmitter.emit("suggested_rule.created", {
      spaceId,
      suggestion: saved,
    });

    return saved;
  }

  /**
   * Analyze a completed execution and generate rule suggestions.
   * Called automatically after an agent finishes work.
   */
  async analyzeExecution(executionId: string): Promise<SuggestedRule[]> {
    const execution = await this.executionRepo.findOne({
      where: { id: executionId },
      relations: { agent: true },
    });
    if (!execution || !execution.agent) return [];

    // Only analyze completed executions with meaningful action logs
    if (execution.status !== "completed" || execution.actionLog.length < 2)
      return [];

    try {
      // Get existing rules to avoid duplicates
      const existingRules = await this.rulesService.findActiveRulesForAgent(
        execution.agent.spaceId,
        execution.agentId,
      );
      const existingRulesText =
        existingRules.length > 0
          ? existingRules.map((r) => `[${r.scope}] ${r.content}`).join("\n")
          : "No existing rules";

      const provider = createMimoProvider(
        this.configService.get("MIMO_API_KEY", ""),
      );

      const response = await generateText({
        model: provider.chatModel(
          this.configService.get("MIMO_MODEL", "mimo-v2-pro"),
        ),
        system: SUGGESTION_PROMPT,
        messages: [
          {
            role: "user",
            content: `Agent type: ${execution.agent.agentType}
Execution action log (${execution.actionLog.length} actions):
${JSON.stringify(execution.actionLog.slice(-20), null, 2)}

Current rules:
${existingRulesText}`,
          },
        ],
        maxTokens: 1024,
      });

      const text = response.text ?? "";

      // Extract JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*"suggestions"[\s\S]*\}/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0)
        return [];

      const suggestions: SuggestedRule[] = [];
      for (const s of parsed.suggestions) {
        const suggestion = this.suggestedRuleRepo.create({
          spaceId: execution.agent.spaceId,
          agentId: execution.agentId,
          executionId: execution.id,
          content: s.content,
          reasoning: s.reasoning,
          suggestedScope: s.scope || "agent",
          status: "pending",
        });
        suggestions.push(await this.suggestedRuleRepo.save(suggestion));
      }

      this.logger.log(
        `Generated ${suggestions.length} rule suggestions from execution ${executionId}`,
      );

      // Emit event so the WS gateway can notify the frontend
      for (const suggestion of suggestions) {
        this.eventEmitter.emit("suggested_rule.created", {
          spaceId: execution.agent.spaceId,
          suggestion,
        });
      }

      // Auto-accept rules that have been suggested 3+ times across executions
      for (const suggestion of suggestions) {
        await this.autoAcceptIfHighConfidence(suggestion);
      }

      return suggestions;
    } catch (error) {
      this.logger.warn(`Failed to analyze execution ${executionId}:`, error);
      return [];
    }
  }

  /**
   * Auto-accept a suggested rule if similar rules have been suggested 3+ times.
   * This creates the actual rule and marks all similar suggestions as accepted.
   */
  private async autoAcceptIfHighConfidence(
    suggestion: SuggestedRule,
  ): Promise<void> {
    try {
      // Find similar pending suggestions for the same agent/space
      const allPending = await this.suggestedRuleRepo.find({
        where: {
          spaceId: suggestion.spaceId,
          agentId: suggestion.agentId ?? undefined,
          status: "pending",
        },
      });

      // Simple similarity: count suggestions whose content shares significant overlap
      const contentLower = suggestion.content.toLowerCase();
      const contentWords = new Set(
        contentLower.split(/\s+/).filter((w) => w.length > 3),
      );

      const similar = allPending.filter((s) => {
        if (s.id === suggestion.id) return true; // Include self
        const otherWords = new Set(
          s.content
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3),
        );
        const intersection = [...contentWords].filter((w) => otherWords.has(w));
        // At least 50% word overlap
        return (
          intersection.length >=
          Math.min(contentWords.size, otherWords.size) * 0.5
        );
      });

      if (similar.length >= 3) {
        this.logger.log(
          `Auto-accepting rule "${suggestion.content.substring(0, 60)}..." — suggested ${similar.length} times`,
        );

        // Accept the rule (creates the actual Rule entity)
        await this.accept(suggestion.id);

        // Mark all similar suggestions as accepted too
        for (const s of similar) {
          if (s.id !== suggestion.id && s.status === "pending") {
            s.status = "accepted";
            await this.suggestedRuleRepo.save(s);
          }
        }

        // Emit auto-accept event
        this.eventEmitter.emit("suggested_rule.auto_accepted", {
          spaceId: suggestion.spaceId,
          suggestion,
          similarCount: similar.length,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Auto-accept check failed for suggestion ${suggestion.id}:`,
        err,
      );
    }
  }
}
