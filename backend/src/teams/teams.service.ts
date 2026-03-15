import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { randomBytes } from "crypto";
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

  async getTeamsForUser(userId: string): Promise<Team[]> {
    const memberships = await this.memberRepo.find({
      where: { userId },
      relations: ["team"],
    });
    return memberships.map((m) => m.team);
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

    // Check seat limit
    const memberCount = await this.memberRepo.count({ where: { teamId } });
    const pendingCount = await this.invitationRepo.count({
      where: { teamId, status: "pending" as InvitationStatus },
    });
    if (memberCount + pendingCount >= team.seatCount) {
      throw new BadRequestException(
        `Seat limit reached (${team.seatCount}). Increase seats in billing to invite more members.`,
      );
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
    const inviter = await this.userRepo.findOneBy({ id: inviterId });
    await this.mailService.sendInvitation({
      to: email,
      teamName: team.name,
      inviterName: inviter?.name ?? "A teammate",
      token,
    });

    this.logger.log(`Invitation sent to ${email} for team ${team.name}`);
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

    this.logger.log(
      `User ${user.email} accepted invitation to team ${invitation.team.name}`,
    );
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

  async updateSeatCount(teamId: string, seatCount: number, userId: string) {
    await this.assertOwner(teamId, userId);
    const team = await this.teamRepo.findOneBy({ id: teamId });
    if (!team) throw new NotFoundException("Team not found");

    const currentMembers = await this.memberRepo.count({ where: { teamId } });
    if (seatCount < currentMembers) {
      throw new BadRequestException(
        `Cannot reduce seats below current member count (${currentMembers})`,
      );
    }

    team.seatCount = seatCount;
    await this.teamRepo.save(team);
    return team;
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
