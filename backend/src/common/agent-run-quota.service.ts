import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Execution } from "../entities/execution.entity";
import { Space } from "../entities/space.entity";
import { User, PlanTier } from "../entities/user.entity";
import {
  API_ERROR_TOKEN_QUOTA_EXCEEDED,
  STARTER_MONTHLY_TOKENS,
  TEAM_MONTHLY_TOKENS,
  ENTERPRISE_MONTHLY_TOKENS,
} from "./subscription.constants";

/** Get the monthly token limit for a plan tier */
export function getMonthlyTokenLimit(planTier: PlanTier): number {
  switch (planTier) {
    case "enterprise":
      return ENTERPRISE_MONTHLY_TOKENS;
    case "team":
      return TEAM_MONTHLY_TOKENS;
    case "starter":
    default:
      return STARTER_MONTHLY_TOKENS;
  }
}

@Injectable()
export class AgentRunQuotaService {
  constructor(
    @InjectRepository(Space) private spaceRepo: Repository<Space>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Execution) private executionRepo: Repository<Execution>,
  ) {}

  /**
   * Enforces monthly token limits for the space owner.
   * Starter: 500K tokens/month
   * Team: 1.5M tokens/month
   * Enterprise: 10M tokens/month
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

    const isActive =
      user.subscriptionStatus === "active" ||
      user.subscriptionStatus === "trialing";
    if (!isActive) {
      return;
    }

    await this.checkMonthlyTokenLimit(user);
  }

  private async checkMonthlyTokenLimit(user: User): Promise<void> {
    const now = new Date();
    let periodStart: Date;

    if (user.currentPeriodEnd) {
      periodStart = new Date(user.currentPeriodEnd);
      periodStart.setDate(periodStart.getDate() - 30);
    } else {
      periodStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
    }

    const monthlyLimit = getMonthlyTokenLimit(user.planTier);

    const result = await this.executionRepo
      .createQueryBuilder("e")
      .innerJoin("e.agent", "agent")
      .innerJoin("agent.space", "space")
      .where("space.userId = :userId", { userId: user.id })
      .andWhere("e.startTime >= :periodStart", { periodStart })
      .select('COALESCE(SUM(e."tokensUsed"), 0)::int', "totalTokens")
      .getRawOne();

    const totalTokens = result?.totalTokens ?? 0;

    if (totalTokens >= monthlyLimit) {
      const upgradeHint =
        user.planTier === "starter"
          ? "Upgrade to Team for higher token limits, or top up usage credits."
          : user.planTier === "team"
            ? "Upgrade to Enterprise for higher limits, or top up usage credits."
            : "Contact support if you need higher limits.";

      throw new ForbiddenException({
        code: API_ERROR_TOKEN_QUOTA_EXCEEDED,
        message: `You've reached your ${user.planTier} plan limit of ${(monthlyLimit / 1_000_000).toFixed(1)}M tokens this billing period. ${upgradeHint}`,
      });
    }
  }

  /**
   * Get current token usage for a user
   */
  async getUsageForUser(userId: string): Promise<{
    tokensThisPeriod: number;
    monthlyTokenLimit: number;
  }> {
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const now = new Date();
    let periodStart: Date;
    if (user.currentPeriodEnd) {
      periodStart = new Date(user.currentPeriodEnd);
      periodStart.setDate(periodStart.getDate() - 30);
    } else {
      periodStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      );
    }

    const result = await this.executionRepo
      .createQueryBuilder("e")
      .innerJoin("e.agent", "agent")
      .innerJoin("agent.space", "space")
      .where("space.userId = :userId", { userId })
      .andWhere("e.startTime >= :periodStart", { periodStart })
      .select('COALESCE(SUM(e."tokensUsed"), 0)::int AS "tokensThisPeriod"')
      .getRawOne();

    return {
      tokensThisPeriod: result?.tokensThisPeriod ?? 0,
      monthlyTokenLimit: getMonthlyTokenLimit(user.planTier),
    };
  }
}
