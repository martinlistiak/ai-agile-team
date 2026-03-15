import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Agent } from "../entities/agent.entity";
import { Execution } from "../entities/execution.entity";

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
    @InjectRepository(Execution) private executionRepo: Repository<Execution>,
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
}
