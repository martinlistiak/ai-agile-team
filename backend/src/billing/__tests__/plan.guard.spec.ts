import { Reflector } from "@nestjs/core";
import { PlanGuard } from "../plan.guard";

describe("PlanGuard", () => {
  const handler = Symbol("handler");
  const klass = Symbol("class");

  function createContext(userId: string) {
    return {
      getHandler: () => handler,
      getClass: () => klass,
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: userId } }),
      }),
    } as any;
  }

  it("inherits plan access from the team owner for collaborators", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["enterprise"]),
    } as unknown as Reflector;
    const userRepo = {
      findOneBy: jest
        .fn()
        .mockResolvedValueOnce({
          id: "member-1",
          planTier: "starter",
          subscriptionStatus: "none",
        })
        .mockResolvedValueOnce({
          id: "owner-1",
          planTier: "enterprise",
          subscriptionStatus: "active",
        }),
    };
    const accessControl = {
      assertTeamMemberOrThrow: jest.fn().mockResolvedValue({
        teamId: "team-1",
        userId: "member-1",
      }),
      getTeamOrThrow: jest.fn().mockResolvedValue({ id: "team-1", ownerId: "owner-1" }),
    };

    const guard = new PlanGuard(
      reflector,
      userRepo as any,
      accessControl as any,
    );

    const context = createContext("member-1");
    context.switchToHttp = () => ({
      getRequest: () => ({ user: { id: "member-1" }, params: { teamId: "team-1" } }),
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("denies users without the required effective plan", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(["team"]),
    } as unknown as Reflector;
    const userRepo = {
      findOneBy: jest.fn().mockResolvedValue({
        id: "user-1",
        planTier: "starter",
        subscriptionStatus: "active",
      }),
    };
    const accessControl = {
      assertTeamMemberOrThrow: jest.fn(),
      getTeamOrThrow: jest.fn(),
    };

    const guard = new PlanGuard(
      reflector,
      userRepo as any,
      accessControl as any,
    );

    await expect(guard.canActivate(createContext("user-1"))).rejects.toThrow(
      "This feature requires a team",
    );
  });
});
