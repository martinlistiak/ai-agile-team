import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { generateText } from "ai";
import { createMimoProvider } from "./mimo-provider";
import { Agent } from "../entities/agent.entity";
import { Execution } from "../entities/execution.entity";
import { RulesService } from "../rules/rules.service";
import { EventsGateway } from "../chat/events.gateway";
import { ExecutionRegistry } from "./execution-registry";
import { AgentRunQuotaService } from "../common/agent-run-quota.service";
import { computeCostWeightedTokens } from "../common/subscription.constants";
import { ModelRouterService } from "./model-router.service";
import { AgentMemoryService } from "./agent-memory.service";
import { appendCompactOutputStyle } from "./compact-output-prompt";

@Injectable()
export class CustomAgentService {
  private readonly logger = new Logger(CustomAgentService.name);

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
  ) {}

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

      systemPrompt = appendCompactOutputStyle(systemPrompt, this.configService);

      const { model: modelName } = this.modelRouter.routeModel(
        "custom",
        userMessage,
        { envModel: this.configService.get("MIMO_MODEL") },
      );

      const provider = createMimoProvider(
        this.configService.get("MIMO_API_KEY", ""),
      );

      const result = await generateText({
        model: provider.chatModel(modelName),
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      const finalText = result.text || "";

      // Store token usage
      execution.inputTokens = result.usage?.promptTokens ?? 0;
      execution.outputTokens = result.usage?.completionTokens ?? 0;
      execution.cacheReadTokens = 0;
      execution.cacheCreationTokens = 0;
      execution.tokensUsed =
        (result.usage?.promptTokens ?? 0) +
        (result.usage?.completionTokens ?? 0);
      execution.modelUsed = modelName;

      execution.costWeightedTokens = computeCostWeightedTokens({
        inputTokens: execution.inputTokens,
        outputTokens: execution.outputTokens,
        cacheReadTokens: execution.cacheReadTokens,
        cacheCreationTokens: execution.cacheCreationTokens,
        modelUsed: execution.modelUsed,
      });

      this.executionRegistry.remove(execution.id);
      execution.status = "completed";
      execution.endTime = new Date();
      await this.executionRepo.save(execution);
      await this.agentRepo.update(agent.id, { status: "idle" });
      this.eventsGateway.emitAgentStatus(spaceId, agent.id, "idle");

      if (execution.costWeightedTokens > 0) {
        this.agentRunQuota
          .deductCreditsForExecution(spaceId, execution.costWeightedTokens)
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
