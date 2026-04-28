import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { randomBytes } from "crypto";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Team } from "../entities/team.entity";
import { TeamMember, TeamRole } from "../entities/team-member.entity";
import {
  TeamInvitation,
  InvitationStatus,
} from "../entities/team-invitation.entity";
import { User } from "../entities/user.entity";
import { MailService } from "./mail.service";

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(
    @InjectRepository(Team) private teamRepo: Repository<Team>,
    @InjectRepository(TeamMember) private memberRepo: Repository<TeamMember>,
    @InjectRepository(TeamInvitation)
    private invitationRepo: Repository<TeamInvitation>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private mailService: MailService,
    private eventEmitter: EventEmitter2,
  ) {}

  async createTeam(userId: string, name: string): Promise<Team> {
    const team = this.teamRepo.create({ name, ownerId: userId, seatCount: 1 });
    await this.teamRepo.save(team);

    // Add creator as owner member
    const member = this.memberRepo.create({
      teamId: team.id,
      userId,
      role: "owner",
    });
    await this.memberRepo.save(member);

    return team;
  }

  async updateTeam(
    teamId: string,
    userId: string,
    name: string,
  ): Promise<Team> {
    await this.assertAdminOrOwner(teamId, userId);

    const team = await this.teamRepo.findOneBy({ id: teamId });
    if (!team) throw new NotFoundException("Team not found");

    team.name = name;
    await this.teamRepo.save(team);

    return team;
  }

  async getTeamsForUser(userId: string): Promise<Team[]> {
    const memberships = await this.memberRepo.find({
      where: { userId },
      relations: ["team"],
    });
    return memberships.map((m) => m.team);
  }

  async hasTeamMembership(userId: string): Promise<boolean> {
    const n = await this.memberRepo.count({ where: { userId } });
    return n > 0;
  }

  /**
   * Returns users that can be assigned to tickets in a space: the space owner plus
   * members of teams owned by that user.
   */
  async getAssignableUsersForOwner(
    ownerId: string,
  ): Promise<
    { id: string; name: string; email: string; avatarUrl: string | null }[]
  > {
    const teams = await this.teamRepo.find({ where: { ownerId } });
    const teamIds = teams.map((t) => t.id);
    if (teamIds.length === 0) {
      const user = await this.userRepo.findOneBy({ id: ownerId });
      return user
        ? [
            {
              id: user.id,
              name: user.name,
              email: user.email,
              avatarUrl: user.avatarUrl,
            },
          ]
        : [];
    }
    const members = await this.memberRepo.find({
      where: { teamId: In(teamIds) },
      relations: ["user"],
    });
    const byId = new Map<
      string,
      { id: string; name: string; email: string; avatarUrl: string | null }
    >();
    for (const m of members) {
      if (m.user && !byId.has(m.user.id)) {
        byId.set(m.user.id, {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl ?? null,
        });
      }
    }
    if (!byId.has(ownerId)) {
      const user = await this.userRepo.findOneBy({ id: ownerId });
      if (user) {
        byId.set(user.id, {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl ?? null,
        });
      }
    }
    return Array.from(byId.values());
  }

  async getTeamWithMembers(teamId: string, userId: string) {
    await this.assertMember(teamId, userId);

    const team = await this.teamRepo.findOne({
      where: { id: teamId },
      relations: ["members", "members.user"],
    });
    if (!team) throw new NotFoundException("Team not found");

    const invitations = await this.invitationRepo.find({
      where: { teamId, status: "pending" as InvitationStatus },
    });

    return {
      id: team.id,
      name: team.name,
      ownerId: team.ownerId,
      seatCount: team.seatCount,
      createdAt: team.createdAt,
      members: team.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        user: {
          id: m.user.id,
          email: m.user.email,
          name: m.user.name,
          avatarUrl: m.user.avatarUrl,
        },
      })),
      pendingInvitations: invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
      })),
    };
  }

  async inviteMember(
    teamId: string,
    inviterId: string,
    email: string,
    role: "admin" | "member" = "member",
  ) {
    const membership = await this.assertAdminOrOwner(teamId, inviterId);
    const team = await this.teamRepo.findOneBy({ id: teamId });
    if (!team) throw new NotFoundException("Team not found");

    // Check member limit (99 max for all plans)
    const currentMemberCount = await this.memberRepo.count({
      where: { teamId },
    });
    const pendingInviteCount = await this.invitationRepo.count({
      where: { teamId, status: "pending" as InvitationStatus },
    });
    if (currentMemberCount + pendingInviteCount >= 99) {
      throw new ForbiddenException(
        "Team has reached the maximum limit of 99 members.",
      );
    }

    const inviter = await this.userRepo.findOneBy({ id: inviterId });
    if (!inviter) throw new NotFoundException("User not found");
    if (inviter.hashedPassword && !inviter.emailVerifiedAt) {
      throw new ForbiddenException(
        "Verify your email address before inviting teammates.",
      );
    }

    // Check if already a member
    const existingUser = await this.userRepo.findOneBy({ email });
    if (existingUser) {
      const existingMember = await this.memberRepo.findOneBy({
        teamId,
        userId: existingUser.id,
      });
      if (existingMember) {
        throw new ConflictException("User is already a team member");
      }
    }

    // Check for existing pending invitation
    const existingInvite = await this.invitationRepo.findOneBy({
      teamId,
      email,
      status: "pending" as InvitationStatus,
    });
    if (existingInvite) {
      throw new ConflictException("Invitation already sent to this email");
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = this.invitationRepo.create({
      teamId,
      email,
      invitedById: inviterId,
      role,
      token,
      status: "pending",
      expiresAt,
    });
    await this.invitationRepo.save(invitation);

    // Send email
    await this.mailService.sendInvitation({
      to: email,
      teamName: team.name,
      inviterName: inviter.name ?? "A teammate",
      token,
    });

    this.logger.log(`Invitation sent to ${email} for team ${team.name}`);

    // Emit notification event
    this.eventEmitter.emit("team.invitation.sent", {
      inviteeEmail: email,
      inviteeUserId: existingUser?.id,
      teamName: team.name,
      inviterName: inviter.name ?? "A teammate",
    });

    return invitation;
  }

  async acceptInvitation(token: string, userId: string) {
    const invitation = await this.invitationRepo.findOne({
      where: { token },
      relations: ["team"],
    });
    if (!invitation) throw new NotFoundException("Invitation not found");
    if (invitation.status !== "pending") {
      throw new BadRequestException("Invitation is no longer valid");
    }
    if (new Date() > invitation.expiresAt) {
      invitation.status = "expired";
      await this.invitationRepo.save(invitation);
      throw new BadRequestException("Invitation has expired");
    }

    // Verify the accepting user's email matches
    const user = await this.userRepo.findOneBy({ id: userId });
    if (!user) throw new NotFoundException("User not found");
    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException(
        "This invitation was sent to a different email address",
      );
    }

    // Check not already a member
    const existing = await this.memberRepo.findOneBy({
      teamId: invitation.teamId,
      userId,
    });
    if (existing) {
      invitation.status = "accepted";
      await this.invitationRepo.save(invitation);
      return { team: invitation.team, alreadyMember: true };
    }

    // Add as member
    const member = this.memberRepo.create({
      teamId: invitation.teamId,
      userId,
      role: invitation.role as TeamRole,
    });
    await this.memberRepo.save(member);

    invitation.status = "accepted";
    await this.invitationRepo.save(invitation);

    // Update seat count to match actual members
    const newMemberCount = await this.memberRepo.count({
      where: { teamId: invitation.teamId },
    });
    const team = await this.teamRepo.findOneBy({ id: invitation.teamId });
    if (team) {
      team.seatCount = newMemberCount;
      await this.teamRepo.save(team);
    }

    this.logger.log(
      `User ${user.email} accepted invitation to team ${invitation.team.name}`,
    );

    // Emit notification event for team member joined
    this.eventEmitter.emit("team.member.joined", {
      teamId: invitation.teamId,
      newMemberName: user.name,
      newMemberId: userId,
    });

    return { team: invitation.team, alreadyMember: false };
  }

  async revokeInvitation(teamId: string, invitationId: string, userId: string) {
    await this.assertAdminOrOwner(teamId, userId);

    const invitation = await this.invitationRepo.findOneBy({
      id: invitationId,
      teamId,
    });
    if (!invitation) throw new NotFoundException("Invitation not found");

    invitation.status = "revoked";
    await this.invitationRepo.save(invitation);
  }

  async removeMember(teamId: string, memberId: string, actorId: string) {
    await this.assertAdminOrOwner(teamId, actorId);

    const member = await this.memberRepo.findOneBy({ id: memberId, teamId });
    if (!member) throw new NotFoundException("Member not found");
    if (member.role === "owner") {
      throw new ForbiddenException("Cannot remove the team owner");
    }

    await this.memberRepo.remove(member);

    // Update seat count
    const newMemberCount = await this.memberRepo.count({ where: { teamId } });
    const team = await this.teamRepo.findOneBy({ id: teamId });
    if (team) {
      team.seatCount = newMemberCount;
      await this.teamRepo.save(team);
    }
  }

  async updateMemberRole(
    teamId: string,
    memberId: string,
    role: "admin" | "member",
    actorId: string,
  ) {
    const actorMembership = await this.assertAdminOrOwner(teamId, actorId);
    const member = await this.memberRepo.findOneBy({ id: memberId, teamId });
    if (!member) throw new NotFoundException("Member not found");
    if (member.role === "owner") {
      throw new ForbiddenException("Cannot change the owner's role");
    }
    // Only owner can promote to admin
    if (role === "admin" && actorMembership.role !== "owner") {
      throw new ForbiddenException("Only the team owner can promote to admin");
    }

    member.role = role;
    await this.memberRepo.save(member);
    return member;
  }

  async getSeatCount(teamId: string, userId: string) {
    await this.assertMember(teamId, userId);
    const memberCount = await this.memberRepo.count({ where: { teamId } });
    return { seatCount: memberCount };
  }

  async getInvitationByToken(token: string) {
    const invitation = await this.invitationRepo.findOne({
      where: { token },
      relations: ["team", "invitedBy"],
    });
    if (!invitation) throw new NotFoundException("Invitation not found");
    return {
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      team: { id: invitation.team.id, name: invitation.team.name },
      invitedBy: {
        name: invitation.invitedBy?.name ?? "Unknown",
      },
    };
  }

  // ── Guards ──

  private async assertMember(
    teamId: string,
    userId: string,
  ): Promise<TeamMember> {
    const member = await this.memberRepo.findOneBy({ teamId, userId });
    if (!member) throw new ForbiddenException("Not a member of this team");
    return member;
  }

  private async assertAdminOrOwner(
    teamId: string,
    userId: string,
  ): Promise<TeamMember> {
    const member = await this.assertMember(teamId, userId);
    if (member.role !== "owner" && member.role !== "admin") {
      throw new ForbiddenException("Requires admin or owner role");
    }
    return member;
  }

  private async assertOwner(
    teamId: string,
    userId: string,
  ): Promise<TeamMember> {
    const member = await this.assertMember(teamId, userId);
    if (member.role !== "owner") {
      throw new ForbiddenException("Requires owner role");
    }
    return member;
  }
}
