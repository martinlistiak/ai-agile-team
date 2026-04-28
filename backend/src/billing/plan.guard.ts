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
import { AccessControlService } from "../common/access-control.service";

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
    private accessControl: AccessControlService,
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

    const effectiveUser = await this.resolveEffectiveUser(context, user);

    // Check if user's plan meets the minimum required
    const userLevel = PLAN_HIERARCHY[effectiveUser.planTier] ?? 0;
    const isActive =
      effectiveUser.subscriptionStatus === "active" ||
      effectiveUser.subscriptionStatus === "trialing";

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

  private async resolveEffectiveUser(
    context: ExecutionContext,
    fallbackUser: User,
  ): Promise<User> {
    const request = context.switchToHttp().getRequest();
    const userId = fallbackUser.id;
    const routePath = `${request.baseUrl ?? ""}${request.route?.path ?? request.originalUrl ?? ""}`;

    if (request.params?.teamId) {
      await this.accessControl.assertTeamMemberOrThrow(request.params.teamId, userId);
      const team = await this.accessControl.getTeamOrThrow(request.params.teamId);
      const owner = await this.userRepo.findOneBy({ id: team.ownerId });
      return owner ?? fallbackUser;
    }

    if (request.params?.spaceId) {
      const space = await this.accessControl.getAccessibleSpaceOrThrow(
        request.params.spaceId,
        userId,
      );
      const owner = await this.userRepo.findOneBy({ id: space.userId });
      return owner ?? fallbackUser;
    }

    if (request.params?.agentId) {
      const agent = await this.accessControl.getAccessibleAgentOrThrow(
        request.params.agentId,
        userId,
      );
      const owner = await this.userRepo.findOneBy({ id: agent.space.userId });
      return owner ?? fallbackUser;
    }

    if (request.params?.id) {
      const ownerId = await this.resolveOwnerIdFromGenericId(
        request.params.id,
        routePath,
        userId,
      );
      if (ownerId) {
        const owner = await this.userRepo.findOneBy({ id: ownerId });
        return owner ?? fallbackUser;
      }
    }

    return fallbackUser;
  }

  private async resolveOwnerIdFromGenericId(
    id: string,
    routePath: string,
    userId: string,
  ): Promise<string | null> {
    if (routePath.includes("/suggested-rules/")) {
      const suggestion = await this.accessControl.getAccessibleSuggestedRuleOrThrow(
        id,
        userId,
      );
      return suggestion.space.userId;
    }

    if (routePath.includes("/rules/")) {
      const rule = await this.accessControl.getAccessibleRuleOrThrow(id, userId);
      return rule.space.userId;
    }

    if (routePath.includes("/tickets/")) {
      const ticket = await this.accessControl.getAccessibleTicketOrThrow(id, userId);
      return ticket.space.userId;
    }

    if (routePath.includes("/agents/")) {
      const agent = await this.accessControl.getAccessibleAgentOrThrow(id, userId);
      return agent.space.userId;
    }

    if (routePath.includes("/training/")) {
      const training = await this.accessControl.getAccessibleTrainingOrThrow(id, userId);
      return training.agent.space.userId;
    }

    return null;
  }
}
