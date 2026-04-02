import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan } from "typeorm";
import Anthropic from "@anthropic-ai/sdk";
import { AgentMemory } from "../entities/agent-memory.entity";
import { Execution } from "../entities/execution.entity";

/**
 * Manages episodic memory for agents — learning from cross-execution patterns.
 *
 * Memories are:
 *  - Created after each execution by analyzing the action log
 *  - Reinforced when similar patterns recur
 *  - Decayed over time if not accessed or reinforced
 *  - Injected into system prompts when confidence is high enough
 */
@Injectable()
export class AgentMemoryService {
  private readonly logger = new Logger(AgentMemoryService.name);
  private client: Anthropic;

  /** Minimum confidence for a memory to be injected into prompts */
  private static readonly INJECTION_THRESHOLD = 0.7;
  /** Max memories to inject per agent */
  private static readonly MAX_INJECTED_MEMORIES = 10;
  /** Decay rate per day of inactivity */
  private static readonly DECAY_RATE_PER_DAY = 0.03;
  /** Below this confidence, memories are pruned */
  private static readonly PRUNE_THRESHOLD = 0.15;

  constructor(
    private configService: ConfigService,
    @InjectRepository(AgentMemory)
    private memoryRepo: Repository<AgentMemory>,
    @InjectRepository(Execution)
    private executionRepo: Repository<Execution>,
  ) {
    this.client = new Anthropic({
      apiKey: this.configService.get("ANTHROPIC_API_KEY", ""),
    });
  }

  /**
   * Analyze a completed execution and extract episodic memories.
   * Called asynchronously after each agent execution.
   */
  async analyzeExecution(executionId: string): Promise<void> {
    const execution = await this.executionRepo.findOne({
      where: { id: executionId },
      relations: ["agent"],
    });

    if (
      !execution ||
      execution.status !== "completed" ||
      !execution.actionLog?.length ||
      execution.actionLog.length < 3
    ) {
      return;
    }

    // Get existing memories to avoid duplicates
    const existingMemories = await this.memoryRepo.find({
      where: { agentId: execution.agentId, spaceId: execution.agent.spaceId },
    });

    const existingSummary = existingMemories
      .map((m) => `- ${m.lesson}`)
      .join("\n");

    // Use a cheap model to extract learnings
    const actionSummary = execution.actionLog
      .slice(-30)
      .map(
        (a: any) =>
          `[${a.tool}] ${typeof a.input === "string" ? a.input.substring(0, 100) : JSON.stringify(a.input).substring(0, 100)}`,
      )
      .join("\n");

    try {
      const response = await this.client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: `You extract reusable lessons from agent execution logs. Output a JSON array of objects with:
- "pattern": what triggered this lesson (2-3 words, e.g. "test file naming")
- "lesson": the reusable insight (1 sentence, actionable)
- "outcome": "success" if the execution went well, "failure" if there were retries/errors, "mixed" otherwise
- "confidence": 0.3-0.7 based on how generalizable the lesson is

Return 0-3 lessons. Only include genuinely reusable insights, not task-specific details.
If the execution was routine with nothing to learn, return an empty array: []

Existing memories (avoid duplicates):
${existingSummary || "(none)"}`,
        messages: [
          {
            role: "user",
            content: `Agent type: ${execution.agent.agentType}\nExecution status: ${execution.status}\n\nAction log:\n${actionSummary}`,
          },
        ],
      });

      const text =
        response.content[0]?.type === "text" ? response.content[0].text : "";
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return;

      const lessons = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(lessons) || lessons.length === 0) return;

      for (const lesson of lessons) {
        if (!lesson.pattern || !lesson.lesson) continue;

        // Check if a similar memory already exists (reinforcement)
        const existing = existingMemories.find(
          (m) =>
            m.pattern === lesson.pattern ||
            m.lesson.toLowerCase().includes(lesson.lesson.toLowerCase().slice(0, 30)),
        );

        if (existing) {
          // Reinforce existing memory
          existing.reinforceCount += 1;
          existing.confidence = Math.min(
            1.0,
            existing.confidence + 0.1,
          );
          existing.lastReinforced = new Date();
          existing.lastAccessed = new Date();
          await this.memoryRepo.save(existing);
          this.logger.debug(
            `Reinforced memory "${existing.pattern}" → confidence ${existing.confidence}`,
          );
        } else {
          // Create new memory
          const memory = this.memoryRepo.create({
            spaceId: execution.agent.spaceId,
            agentId: execution.agentId,
            executionId: execution.id,
            pattern: lesson.pattern,
            lesson: lesson.lesson,
            outcome: lesson.outcome || "success",
            confidence: lesson.confidence ?? 0.5,
          });
          await this.memoryRepo.save(memory);
          this.logger.debug(`Created memory: "${lesson.pattern}"`);
        }
      }
    } catch (err) {
      this.logger.warn(`Memory extraction failed for execution ${executionId}:`, err);
    }
  }

  /**
   * Get memories ready for injection into an agent's system prompt.
   * Returns formatted markdown string of high-confidence memories.
   */
  async compileMemoriesForAgent(
    spaceId: string,
    agentId: string,
  ): Promise<string> {
    // Apply decay before querying
    await this.applyDecay(spaceId, agentId);

    const memories = await this.memoryRepo.find({
      where: {
        spaceId,
        agentId,
        confidence: MoreThan(AgentMemoryService.INJECTION_THRESHOLD),
      },
      order: { confidence: "DESC", reinforceCount: "DESC" },
      take: AgentMemoryService.MAX_INJECTED_MEMORIES,
    });

    if (memories.length === 0) return "";

    // Mark as accessed
    const now = new Date();
    for (const m of memories) {
      m.accessCount += 1;
      m.lastAccessed = now;
    }
    await this.memoryRepo.save(memories);

    const lines = memories.map(
      (m) => `- ${m.lesson} (confidence: ${(m.confidence * 100).toFixed(0)}%)`,
    );

    return lines.join("\n");
  }

  /**
   * Apply Ebbinghaus-inspired decay to memories that haven't been accessed or reinforced recently.
   */
  private async applyDecay(spaceId: string, agentId: string): Promise<void> {
    const memories = await this.memoryRepo.find({
      where: { spaceId, agentId },
    });

    const now = Date.now();
    const toSave: AgentMemory[] = [];
    const toDelete: string[] = [];

    for (const memory of memories) {
      const daysSinceAccess =
        (now - new Date(memory.lastAccessed).getTime()) / (1000 * 60 * 60 * 24);
      const daysSinceReinforced =
        (now - new Date(memory.lastReinforced).getTime()) / (1000 * 60 * 60 * 24);

      // Use the more recent of access/reinforcement for decay calculation
      const daysSinceActivity = Math.min(daysSinceAccess, daysSinceReinforced);

      if (daysSinceActivity > 1) {
        // Reinforced memories decay slower
        const decayMultiplier = 1 / Math.max(1, memory.reinforceCount * 0.5);
        const decay =
          daysSinceActivity *
          AgentMemoryService.DECAY_RATE_PER_DAY *
          decayMultiplier;
        memory.confidence = Math.max(0, memory.confidence - decay);

        if (memory.confidence < AgentMemoryService.PRUNE_THRESHOLD) {
          toDelete.push(memory.id);
        } else {
          toSave.push(memory);
        }
      }
    }

    if (toSave.length > 0) {
      await this.memoryRepo.save(toSave);
    }
    if (toDelete.length > 0) {
      await this.memoryRepo.delete(toDelete);
      this.logger.debug(
        `Pruned ${toDelete.length} decayed memories for agent ${agentId}`,
      );
    }
  }
}
