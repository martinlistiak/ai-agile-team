import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { Space } from "../entities/space.entity";
import { Agent } from "../entities/agent.entity";

@Injectable()
export class SpacesService {
  constructor(
    @InjectRepository(Space) private spaceRepo: Repository<Space>,
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
    private dataSource: DataSource,
  ) {}

  async findAll(): Promise<Space[]> {
    return this.spaceRepo.find();
  }

  async findAllByUser(userId: string): Promise<Space[]> {
    return this.spaceRepo.find({
      where: { userId },
      order: { order: "ASC", createdAt: "ASC" },
    });
  }

  async findById(id: string): Promise<Space> {
    const space = await this.spaceRepo.findOneBy({ id });
    if (!space) throw new NotFoundException("Space not found");
    return space;
  }

  async create(
    userId: string,
    data: { name: string; githubRepoUrl?: string; gitlabRepoUrl?: string },
  ): Promise<Space> {
    const derivedName =
      data.name?.trim() ||
      this.extractRepoName(data.githubRepoUrl) ||
      this.extractRepoName(data.gitlabRepoUrl);
    if (!derivedName) {
      throw new NotFoundException("Space name is required");
    }

    // Assign next order value for this user
    const maxResult = await this.spaceRepo
      .createQueryBuilder("space")
      .select("COALESCE(MAX(space.order), -1)", "maxOrder")
      .where("space.userId = :userId", { userId })
      .getRawOne();
    const nextOrder = (maxResult?.maxOrder ?? -1) + 1;

    const space = await this.dataSource.transaction(async (manager) => {
      const spaceEntity = manager.create(Space, {
        userId,
        name: derivedName,
        githubRepoUrl: data.githubRepoUrl,
        gitlabRepoUrl: data.gitlabRepoUrl,
        order: nextOrder,
      });
      await manager.save(spaceEntity);

      // Auto-create all four agents for the space
      const agents = [
        { agentType: "pm", avatarRef: "pm_default.png" },
        { agentType: "developer", avatarRef: "dev_default.png" },
        { agentType: "reviewer", avatarRef: "reviewer_default.png" },
        { agentType: "tester", avatarRef: "tester_default.png" },
      ].map((def) =>
        manager.create(Agent, {
          spaceId: spaceEntity.id,
          agentType: def.agentType,
          avatarRef: def.avatarRef,
          status: "idle",
        }),
      );
      await manager.save(agents);

      return spaceEntity;
    });

    return space;
  }

  private extractRepoName(githubRepoUrl?: string): string | null {
    if (!githubRepoUrl) return null;

    try {
      const pathname = new URL(githubRepoUrl).pathname;
      const segments = pathname.split("/").filter(Boolean);
      const repoName = segments[segments.length - 1];
      // and final capitalize each word
      return repoName
        ? repoName
            .replace(/\.git$/, "")
            .replace(/-/g, " ")
            .replace(/_/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase())
        : null;
    } catch {
      return null;
    }
  }

  async update(id: string, data: Partial<Space>): Promise<Space> {
    await this.spaceRepo.update(id, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Get agent IDs for this space
      const agents: { id: string }[] = await manager.query(
        `SELECT id FROM agents WHERE "spaceId" = $1`,
        [id],
      );
      const agentIds = agents.map((a) => a.id);

      // Get ticket IDs for this space
      const tickets: { id: string }[] = await manager.query(
        `SELECT id FROM tickets WHERE "spaceId" = $1`,
        [id],
      );
      const ticketIds = tickets.map((t) => t.id);

      // Delete executions (FK to agents and tickets)
      if (agentIds.length > 0) {
        await manager.query(
          `DELETE FROM executions WHERE "agentId" = ANY($1)`,
          [agentIds],
        );
      }
      if (ticketIds.length > 0) {
        await manager.query(
          `DELETE FROM executions WHERE "ticketId" = ANY($1)`,
          [ticketIds],
        );
      }

      // Delete tickets (FK to agents via assigneeAgentId)
      await manager.query(`DELETE FROM tickets WHERE "spaceId" = $1`, [id]);

      // Delete agents
      await manager.query(`DELETE FROM agents WHERE "spaceId" = $1`, [id]);

      // Delete space (cascades to chat_messages, rules, suggested_rules via DB)
      await manager.query(`DELETE FROM spaces WHERE id = $1`, [id]);
    });
  }

  async reorder(userId: string, orderedIds: string[]): Promise<void> {
    await Promise.all(
      orderedIds.map((id, index) =>
        this.spaceRepo
          .createQueryBuilder()
          .update(Space)
          .set({ order: index })
          .where('id = :id AND "userId" = :userId', { id, userId })
          .execute(),
      ),
    );
  }
}
