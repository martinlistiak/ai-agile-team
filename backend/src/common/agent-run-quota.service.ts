import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Execution } from "../entities/execution.entity";
import { Space } from "../entities/space.entity";
import { User } from "../entities/user.entity";
import {
  API_ERROR_AGENT_RUN_QUOTA_EXCEEDED,
  STARTER_DAILY_AGENT_RUNS,
  TEAM_DAILY_AGENT_RUNS,
} from "./subscription.constants";

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

@Injectable()
export class AgentRunQuotaService {
  constructor(
    @InjectRepository(Space) private spaceRepo: Repository<Space>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Execution) private executionRepo: Repository<Execution>,
  ) {}

  /**
   * Enforces daily agent run limits for the space owner.
   * Starter: 10/day, Team: 50/day, Enterprise: unlimited.
   */
  async assertCanStartRunForSpace(spaceId: string): Promise<void> {
    const space = await this.spaceRepo.findOneBy({ id: spaceId });
    if (!space) {
      throw new NotFoundException("Space not found");
    }

    const user = await this.userRepo.findOneBy({ id: space.userId });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Enterprise is unlimited
    if (user.planTier === "enterprise") {
      return;
    }

    const isActive =
      user.subscriptionStatus === "active" ||
      user.subscriptionStatus === "trialing";
    if (!isActive) {
      return;
    }

    const dayStart = startOfUtcDay(new Date());
    const count = await this.executionRepo
      .createQueryBuilder("e")
      .innerJoin("e.agent", "agent")
      .innerJoin("agent.space", "space")
      .where("space.userId = :userId", { userId: space.userId })
      .andWhere("e.startTime >= :dayStart", { dayStart })
      .getCount();

    if (user.planTier === "starter" && count >= STARTER_DAILY_AGENT_RUNS) {
      throw new ForbiddenException({
        code: API_ERROR_AGENT_RUN_QUOTA_EXCEEDED,
        message: `You've reached your Starter plan limit of ${STARTER_DAILY_AGENT_RUNS} AI agent runs today (UTC). Upgrade to Team for higher usage.`,
      });
    }

    if (user.planTier === "team" && count >= TEAM_DAILY_AGENT_RUNS) {
      throw new ForbiddenException({
        code: API_ERROR_AGENT_RUN_QUOTA_EXCEEDED,
        message: `You've reached your Team plan limit of ${TEAM_DAILY_AGENT_RUNS} AI agent runs today (UTC). Upgrade to Enterprise for unlimited runs.`,
      });
    }
  }
}
