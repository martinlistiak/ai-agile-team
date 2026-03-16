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

const DEFAULT_MODEL = "claude-sonnet-4-20250514";

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

      const compiledRules = await this.rulesService.compileRulesForAgent(
        spaceId,
        agent.id,
      );
      const systemPrompt = compiledRules
        ? `${basePrompt}\n\n# Active Rules\n${compiledRules}`
        : basePrompt;

      const model =
        this.configService.get("ANTHROPIC_MODEL") || DEFAULT_MODEL;

      const response = await this.client.messages.create({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      let finalText = "";
      for (const block of response.content) {
        if (block.type === "text") {
          finalText += block.text;
        }
      }

      this.executionRegistry.remove(execution.id);
      execution.status = "completed";
      execution.endTime = new Date();
      await this.executionRepo.save(execution);
      await this.agentRepo.update(agent.id, { status: "idle" });
      this.eventsGateway.emitAgentStatus(spaceId, agent.id, "idle");

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
