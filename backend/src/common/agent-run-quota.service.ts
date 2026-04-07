import {
  ForbiddenException,
  Injectable,
  Logger,
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
  TOKENS_PER_CENT,
} from "./subscription.constants";
import { EventEmitter2 } from "@nestjs/event-emitter";

/** Get the monthly token limit for a plan tier, scaled by number of spaces */
export function getMonthlyTokenLimit(
  planTier: PlanTier,
  spaceCount: number = 1,
): number {
  const perSpaceLimit = (() => {
    switch (planTier) {
      case "enterprise":
        return ENTERPRISE_MONTHLY_TOKENS;
      case "team":
        return TEAM_MONTHLY_TOKENS;
      case "starter":
      default:
        return STARTER_MONTHLY_TOKENS;
    }
  })();
  return perSpaceLimit * Math.max(spaceCount, 1);
}

/** Convert tokens to cents (for credit deduction) */
export function tokensToCents(tokens: number): number {
  return Math.ceil(tokens / TOKENS_PER_CENT);
}

/** Convert cents to tokens (for display) */
export function centsToTokens(cents: number): number {
  return cents * TOKENS_PER_CENT;
}

@Injectable()
export class AgentRunQuotaService {
  private readonly logger = new Logger(AgentRunQuotaService.name);

  constructor(
    @InjectRepository(Space) private spaceRepo: Repository<Space>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Execution) private executionRepo: Repository<Execution>,
    private eventEmitter: EventEmitter2,
  ) {}

  /** Count the number of spaces owned by a user */
  private async countUserSpaces(userId: string): Promise<number> {
    return this.spaceRepo.count({ where: { userId } });
  }

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

    const monthlyLimit = getMonthlyTokenLimit(
      user.planTier,
      await this.countUserSpaces(user.id),
    );

    const result = await this.executionRepo
      .createQueryBuilder("e")
      .innerJoin("e.agent", "agent")
      .innerJoin("agent.space", "space")
      .where("space.userId = :userId", { userId: user.id })
      .andWhere("e.startTime >= :periodStart", { periodStart })
      .select('COALESCE(SUM(e."costWeightedTokens"), 0)::int', "totalTokens")
      .getRawOne();

    const totalTokens = result?.totalTokens ?? 0;

    if (totalTokens >= monthlyLimit) {
      // Check if user has credits to continue
      if (user.creditsBalance > 0) {
        this.logger.log(
          `User ${user.id} exceeded monthly limit but has ${user.creditsBalance} cents in credits, allowing run`,
        );
        return; // Allow the run, credits will be deducted after execution
      }

      const upgradeHint =
        user.planTier === "starter"
          ? "Upgrade to Team for 20M tokens/month, or top up usage credits."
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
      .select(
        'COALESCE(SUM(e."costWeightedTokens"), 0)::int AS "tokensThisPeriod"',
      )
      .getRawOne();

    return {
      tokensThisPeriod: result?.tokensThisPeriod ?? 0,
      monthlyTokenLimit: getMonthlyTokenLimit(
        user.planTier,
        await this.countUserSpaces(user.id),
      ),
    };
  }

  /**
   * Deduct credits for cost-weighted tokens used beyond the monthly quota.
   * Called after each agent execution completes.
   * Only deducts if the user has exceeded their monthly limit.
   */
  async deductCreditsForExecution(
    spaceId: string,
    costWeightedTokens: number,
  ): Promise<{ creditsDeducted: number; remainingCredits: number }> {
    if (costWeightedTokens <= 0) {
      return { creditsDeducted: 0, remainingCredits: 0 };
    }

    const space = await this.spaceRepo.findOneBy({ id: spaceId });
    if (!space) {
      return { creditsDeducted: 0, remainingCredits: 0 };
    }

    const user = await this.userRepo.findOneBy({ id: space.userId });
    if (!user) {
      return { creditsDeducted: 0, remainingCredits: 0 };
    }

    // Check if user is over their monthly limit
    const { tokensThisPeriod, monthlyTokenLimit } = await this.getUsageForUser(
      user.id,
    );

    // Calculate how many tokens are over the limit
    // tokensThisPeriod already includes the current execution's tokens
    const tokensOverLimit = tokensThisPeriod - monthlyTokenLimit;

    if (tokensOverLimit <= 0) {
      // Still within monthly quota, no credits needed
      return { creditsDeducted: 0, remainingCredits: user.creditsBalance };
    }

    // Calculate how many of THIS execution's tokens should be charged to credits
    // If we just went over, only charge the overage portion
    // If we were already over, charge all tokens from this execution
    const tokensToCharge = Math.min(costWeightedTokens, tokensOverLimit);
    const centsToDeduct = tokensToCents(tokensToCharge);

    if (centsToDeduct <= 0) {
      return { creditsDeducted: 0, remainingCredits: user.creditsBalance };
    }

    // Deduct credits (clamp to available balance)
    const actualDeduction = Math.min(centsToDeduct, user.creditsBalance);
    if (actualDeduction > 0) {
      await this.userRepo.decrement(
        { id: user.id },
        "creditsBalance",
        actualDeduction,
      );

      const updatedUser = await this.userRepo.findOneBy({ id: user.id });
      const remainingCredits = updatedUser?.creditsBalance ?? 0;

      this.logger.log(
        `Deducted ${actualDeduction} cents (${tokensToCharge} tokens) from user ${user.id}. Remaining: ${remainingCredits} cents`,
      );

      // Emit event if credits are exhausted
      if (remainingCredits <= 0) {
        this.eventEmitter.emit("credits.exhausted", { email: user.email });
      }

      return { creditsDeducted: actualDeduction, remainingCredits };
    }

    return { creditsDeducted: 0, remainingCredits: user.creditsBalance };
  }
}
