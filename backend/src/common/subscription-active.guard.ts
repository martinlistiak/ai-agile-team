import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TeamMember } from "../entities/team-member.entity";
import { SKIP_SUBSCRIPTION_KEY } from "./subscription.constants";

@Injectable()
export class SubscriptionActiveGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(TeamMember)
    private memberRepo: Repository<TeamMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_SUBSCRIPTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as { id?: string; subscriptionStatus?: string } | undefined;
    if (!user?.id) return true;

    const status = user.subscriptionStatus;
    if (status === "active" || status === "trialing") return true;

    const teamCount = await this.memberRepo.count({ where: { userId: user.id } });
    if (teamCount > 0) return true;

    throw new ForbiddenException(
      "An active subscription or trial is required. Choose a plan on the Billing page to start your 7-day free trial.",
    );
  }
}
