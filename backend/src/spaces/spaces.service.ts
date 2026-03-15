import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Space } from "../entities/space.entity";
import { Agent } from "../entities/agent.entity";

@Injectable()
export class SpacesService {
  constructor(
    @InjectRepository(Space) private spaceRepo: Repository<Space>,
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
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

    const space = this.spaceRepo.create({
      userId,
      name: derivedName,
      githubRepoUrl: data.githubRepoUrl,
      gitlabRepoUrl: data.gitlabRepoUrl,
      order: nextOrder,
    });
    await this.spaceRepo.save(space);

    // Auto-create all three agents for the space
    const agents = [
      { agentType: "pm", avatarRef: "pm_default.png" },
      { agentType: "developer", avatarRef: "dev_default.png" },
      { agentType: "tester", avatarRef: "tester_default.png" },
    ].map((def) =>
      this.agentRepo.create({
        spaceId: space.id,
        agentType: def.agentType,
        avatarRef: def.avatarRef,
        status: "idle",
      }),
    );
    await this.agentRepo.save(agents);

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
    await this.spaceRepo.delete(id);
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
