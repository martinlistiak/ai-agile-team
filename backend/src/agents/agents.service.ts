import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Agent } from "../entities/agent.entity";
import { Execution } from "../entities/execution.entity";
import { ExecutionRegistry } from "./execution-registry";
import { EventsGateway } from "../chat/events.gateway";

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
    @InjectRepository(Execution) private executionRepo: Repository<Execution>,
    private executionRegistry: ExecutionRegistry,
    private eventsGateway: EventsGateway,
  ) {}

  async findBySpace(spaceId: string): Promise<Agent[]> {
    return this.agentRepo.find({ where: { spaceId } });
  }

  async findById(id: string): Promise<Agent | null> {
    return this.agentRepo.findOneBy({ id });
  }

  async findPmAgent(spaceId: string): Promise<Agent | null> {
    return this.agentRepo.findOneBy({ spaceId, agentType: "pm" });
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.agentRepo.update(id, { status });
  }

  async updateRules(id: string, rules: string): Promise<Agent | null> {
    await this.agentRepo.update(id, { rules });
    return this.agentRepo.findOneBy({ id });
  }

  async getExecutionsByAgent(
    agentId: string,
    page: number,
    limit: number,
  ): Promise<{ data: Execution[]; total: number; page: number }> {
    const [data, total] = await this.executionRepo.findAndCount({
      where: { agentId },
      order: { startTime: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page };
  }

  async stopExecution(agentId: string): Promise<{ stopped: boolean }> {
    const agent = await this.agentRepo.findOneBy({ id: agentId });
    if (!agent) return { stopped: false };

    // Find the latest running execution for this agent
    const execution = await this.executionRepo.findOne({
      where: { agentId, status: "running" },
      order: { startTime: "DESC" },
    });

    // Try to abort via the registry (signals the SDK's AbortController)
    if (execution) {
      this.executionRegistry.abort(execution.id);
      execution.status = "failed";
      execution.endTime = new Date();
      await this.executionRepo.save(execution);
    }

    // Always force the agent back to idle — even if no execution was found
    // (handles edge cases like server restart where registry is empty)
    await this.agentRepo.update(agentId, { status: "idle" });
    this.eventsGateway.emitAgentStatus(agent.spaceId, agentId, "idle");

    return { stopped: true };
  }
}
