import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User, PlanTier } from "../entities/user.entity";

export const REQUIRED_PLAN_KEY = "requiredPlan";
export const RequirePlan = (...plans: PlanTier[]) =>
  SetMetadata(REQUIRED_PLAN_KEY, plans);

const PLAN_HIERARCHY: Record<PlanTier, number> = {
  starter: 0,
  team: 1,
  enterprise: 2,
};

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlans = this.reflector.getAllAndOverride<PlanTier[]>(
      REQUIRED_PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPlans || requiredPlans.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) return false;

    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) return false;

    // Check if user's plan meets the minimum required
    const userLevel = PLAN_HIERARCHY[user.planTier] ?? 0;
    const isActive =
      user.subscriptionStatus === "active" ||
      user.subscriptionStatus === "trialing";

    if (!isActive) {
      throw new ForbiddenException(
        "Your subscription is not active. Please update your billing.",
      );
    }

    const meetsRequirement = requiredPlans.some(
      (plan) => userLevel >= PLAN_HIERARCHY[plan],
    );

    if (!meetsRequirement) {
      throw new ForbiddenException(
        `This feature requires a ${requiredPlans.join(" or ")} plan. Please upgrade.`,
      );
    }

    return true;
  }
}
