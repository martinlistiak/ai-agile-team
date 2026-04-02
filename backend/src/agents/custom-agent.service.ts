import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import Anthropic from "@anthropic-ai/sdk";
import { Agent } from "../entities/agent.entity";
import { Execution } from "../entities/execution.entity";
import { RulesService } from "../rules/rules.service";
import { EventsGateway } from "../chat/events.gateway";
import { ExecutionRegistry } from "./execution-registry";
import { AgentRunQuotaService } from "../common/agent-run-quota.service";
import { ModelRouterService } from "./model-router.service";
import { AgentMemoryService } from "./agent-memory.service";

@Injectable()
export class CustomAgentService {
  private readonly logger = new Logger(CustomAgentService.name);
  private client: Anthropic;

  constructor(
    private configService: ConfigService,
    private rulesService: RulesService,
    @Inject(forwardRef(() => EventsGateway))
    private eventsGateway: EventsGateway,
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
    @InjectRepository(Execution) private executionRepo: Repository<Execution>,
    private executionRegistry: ExecutionRegistry,
    private agentRunQuota: AgentRunQuotaService,
    private modelRouter: ModelRouterService,
    private agentMemory: AgentMemoryService,
  ) {
    this.client = new Anthropic({
      apiKey: this.configService.get("ANTHROPIC_API_KEY", ""),
    });
  }

  async run(
    spaceId: string,
    agentId: string,
    userMessage: string,
  ): Promise<string> {
    const agent = await this.agentRepo.findOneBy({ id: agentId, spaceId });
    if (!agent) {
      throw new Error(`Custom agent ${agentId} not found in space ${spaceId}`);
    }

    await this.agentRunQuota.assertCanStartRunForSpace(spaceId);

    await this.agentRepo.update(agent.id, { status: "active" });
    this.eventsGateway.emitAgentStatus(spaceId, agent.id, "active");

    const execution = this.executionRepo.create({
      agentId: agent.id,
      status: "running",
      actionLog: [],
    });
    await this.executionRepo.save(execution);
    this.executionRegistry.register(execution.id);

    try {
      const basePrompt =
        agent.systemPrompt ||
        `You are a helpful AI assistant named "${agent.name || "Custom Agent"}".${agent.description ? ` ${agent.description}` : ""} Answer questions and help the user.`;

      const [compiledRules, compiledMemories] = await Promise.all([
        this.rulesService.compileRulesForAgent(spaceId, agent.id),
        this.agentMemory.compileMemoriesForAgent(spaceId, agent.id),
      ]);
      let systemPrompt = basePrompt;
      if (compiledRules) {
        systemPrompt += `\n\n# Active Rules\n${compiledRules}`;
      }
      if (compiledMemories) {
        systemPrompt += `\n\n# Learned Patterns\nApply these lessons from past executions:\n${compiledMemories}`;
      }

      const { model } = this.modelRouter.routeModel("custom", userMessage, {
        envModel: this.configService.get("ANTHROPIC_MODEL"),
      });

      const response = await this.client.messages.create({
        model,
        max_tokens: 4096,
        system: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userMessage }],
      });

      let finalText = "";
      for (const block of response.content) {
        if (block.type === "text") {
          finalText += block.text;
        }
      }

      // Store token usage on execution
      execution.inputTokens = response.usage?.input_tokens ?? 0;
      execution.outputTokens = response.usage?.output_tokens ?? 0;
      execution.cacheReadTokens =
        (response.usage as any)?.cache_read_input_tokens ?? 0;
      execution.cacheCreationTokens =
        (response.usage as any)?.cache_creation_input_tokens ?? 0;
      execution.tokensUsed =
        (response.usage?.input_tokens ?? 0) +
        (response.usage?.output_tokens ?? 0);
      execution.modelUsed = model;

      this.executionRegistry.remove(execution.id);
      execution.status = "completed";
      execution.endTime = new Date();
      await this.executionRepo.save(execution);
      await this.agentRepo.update(agent.id, { status: "idle" });
      this.eventsGateway.emitAgentStatus(spaceId, agent.id, "idle");

      // Deduct credits if over monthly quota
      if (execution.tokensUsed > 0) {
        this.agentRunQuota
          .deductCreditsForExecution(spaceId, execution.tokensUsed)
          .catch((err) =>
            this.logger.warn(
              `Credit deduction failed for execution ${execution.id}:`,
              err,
            ),
          );
      }

      return finalText || "I've processed your request.";
    } catch (error) {
      this.logger.error("Custom Agent error:", error);
      this.executionRegistry.remove(execution.id);
      execution.status = "failed";
      execution.endTime = new Date();
      await this.executionRepo.save(execution);
      await this.agentRepo.update(agent.id, { status: "error" });
      this.eventsGateway.emitAgentStatus(spaceId, agent.id, "error");
      throw error;
    }
  }
}
