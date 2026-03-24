import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationsService } from "./notifications.service";
import { SlackService } from "./slack.service";
import { Ticket } from "../entities/ticket.entity";
import { Space } from "../entities/space.entity";
import { TeamMember } from "../entities/team-member.entity";

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private notificationsService: NotificationsService,
    private slackService: SlackService,
    @InjectRepository(Space) private spaceRepo: Repository<Space>,
    @InjectRepository(TeamMember) private memberRepo: Repository<TeamMember>,
  ) {}

  /** Resolve all user IDs that should be notified for a given space. */
  private async getSpaceRecipients(
    spaceId: string,
    excludeUserId?: string,
  ): Promise<string[]> {
    const space = await this.spaceRepo.findOneBy({ id: spaceId });
    if (!space) return [];

    // Space owner is always a recipient
    const userIds = new Set<string>([space.userId]);

    // Also include team members who have access to this space's team
    const members = await this.memberRepo.find({
      where: { teamId: space.userId }, // fallback — teams are looked up by owner
    });
    for (const m of members) userIds.add(m.userId);

    if (excludeUserId) userIds.delete(excludeUserId);
    return Array.from(userIds);
  }

  // --- Agent events ---

  @OnEvent("agent.execution.completed")
  async handleAgentCompleted(payload: {
    spaceId: string;
    agentType: string;
    agentName: string;
    ticketId?: string;
    ticketTitle?: string;
    executionId: string;
  }) {
    const recipients = await this.getSpaceRecipients(payload.spaceId);
    await this.notificationsService.notifyMany(recipients, {
      type: "agent_completed",
      title: `${payload.agentName ?? payload.agentType} agent finished`,
      message: payload.ticketTitle
        ? `Agent completed work on "${payload.ticketTitle}"`
        : `Agent execution completed successfully`,
      relatedEntityId: payload.executionId,
      relatedEntityType: "execution",
      spaceId: payload.spaceId,
    });
    await this.slackService.notifyAgentCompleted(
      payload.agentName ?? payload.agentType,
      payload.ticketTitle,
    );
  }

  @OnEvent("agent.execution.failed")
  async handleAgentFailed(payload: {
    spaceId: string;
    agentType: string;
    agentName: string;
    ticketId?: string;
    ticketTitle?: string;
    executionId: string;
    error?: string;
  }) {
    const recipients = await this.getSpaceRecipients(payload.spaceId);
    await this.notificationsService.notifyMany(recipients, {
      type: "agent_failed",
      title: `${payload.agentName ?? payload.agentType} agent failed`,
      message: payload.error
        ? `Agent failed: ${payload.error.slice(0, 200)}`
        : `Agent execution failed`,
      relatedEntityId: payload.executionId,
      relatedEntityType: "execution",
      spaceId: payload.spaceId,
    });
    await this.slackService.notifyAgentFailed(
      payload.agentName ?? payload.agentType,
      payload.error,
    );
  }

  // --- Pipeline events ---

  @OnEvent("pipeline.stage.changed")
  async handlePipelineStageChanged(payload: {
    spaceId: string;
    ticketId: string;
    ticketTitle: string;
    fromStage: string;
    toStage: string;
  }) {
    const recipients = await this.getSpaceRecipients(payload.spaceId);
    await this.notificationsService.notifyMany(recipients, {
      type: "pipeline_stage_changed",
      title: `Ticket moved to ${payload.toStage}`,
      message: `"${payload.ticketTitle}" moved from ${payload.fromStage} to ${payload.toStage}`,
      relatedEntityId: payload.ticketId,
      relatedEntityType: "ticket",
      spaceId: payload.spaceId,
    });
    await this.slackService.notifyPipelineStageChanged(
      payload.ticketTitle,
      payload.fromStage,
      payload.toStage,
    );
  }

  // --- PR events ---

  @OnEvent("pr.created")
  async handlePrCreated(payload: {
    spaceId: string;
    ticketId: string;
    ticketTitle: string;
    prUrl: string;
    prNumber: number;
  }) {
    const recipients = await this.getSpaceRecipients(payload.spaceId);
    await this.notificationsService.notifyMany(recipients, {
      type: "pr_created",
      title: `Pull request #${payload.prNumber} created`,
      message: `PR created for "${payload.ticketTitle}"`,
      relatedEntityId: payload.ticketId,
      relatedEntityType: "ticket",
      spaceId: payload.spaceId,
    });
    await this.slackService.notifyPrCreated(
      payload.ticketTitle,
      payload.prNumber,
      payload.prUrl,
    );
  }

  // --- Ticket events ---

  @OnEvent("ticket.assigned")
  async handleTicketAssigned(payload: {
    spaceId: string;
    ticketId: string;
    ticketTitle: string;
    assigneeId: string;
    assignerName: string;
  }) {
    await this.notificationsService.notify({
      userId: payload.assigneeId,
      type: "ticket_assigned",
      title: "Ticket assigned to you",
      message: `${payload.assignerName} assigned "${payload.ticketTitle}" to you`,
      relatedEntityId: payload.ticketId,
      relatedEntityType: "ticket",
      spaceId: payload.spaceId,
    });
    await this.slackService.notifyTicketAssigned(
      payload.ticketTitle,
      payload.assignerName,
    );
  }

  @OnEvent("ticket.commented")
  async handleTicketCommented(payload: {
    spaceId: string;
    ticketId: string;
    ticketTitle: string;
    commenterId: string;
    commenterName: string;
  }) {
    const recipients = await this.getSpaceRecipients(
      payload.spaceId,
      payload.commenterId,
    );
    await this.notificationsService.notifyMany(recipients, {
      type: "ticket_commented",
      title: `New comment on "${payload.ticketTitle}"`,
      message: `${payload.commenterName} commented on "${payload.ticketTitle}"`,
      relatedEntityId: payload.ticketId,
      relatedEntityType: "ticket",
      spaceId: payload.spaceId,
    });
    await this.slackService.notifyTicketCommented(
      payload.ticketTitle,
      payload.commenterName,
    );
  }

  // --- Team events ---

  @OnEvent("team.invitation.sent")
  async handleTeamInvitationSent(payload: {
    inviteeEmail: string;
    inviteeUserId?: string;
    teamName: string;
    inviterName: string;
  }) {
    // Only create in-app notification if the invitee already has an account
    if (payload.inviteeUserId) {
      await this.notificationsService.notify({
        userId: payload.inviteeUserId,
        type: "team_invitation",
        title: "Team invitation",
        message: `${payload.inviterName} invited you to join ${payload.teamName}`,
      });
    }
    await this.slackService.notifyTeamInvitation(
      payload.inviterName,
      payload.teamName,
      payload.inviteeEmail,
    );
  }

  @OnEvent("team.member.joined")
  async handleTeamMemberJoined(payload: {
    teamId: string;
    newMemberName: string;
    newMemberId: string;
  }) {
    const members = await this.memberRepo.find({
      where: { teamId: payload.teamId },
    });
    const recipientIds = members
      .map((m) => m.userId)
      .filter((id) => id !== payload.newMemberId);

    await this.notificationsService.notifyMany(recipientIds, {
      type: "team_member_joined",
      title: "New team member",
      message: `${payload.newMemberName} joined the team`,
    });
    await this.slackService.notifyTeamMemberJoined(payload.newMemberName);
  }

  // --- Slack notification events ---

  @OnEvent("user.signup")
  async handleUserSignup(payload: { email: string; name: string }) {
    await this.slackService.notifySignup(payload.email, payload.name);
  }

  @OnEvent("credits.topup")
  async handleCreditTopUp(payload: { email: string; amountCents: number }) {
    await this.slackService.notifyCreditTopUp(
      payload.email,
      payload.amountCents,
    );
  }

  @OnEvent("credits.exhausted")
  async handleCreditsExhausted(payload: { email: string }) {
    await this.slackService.notifyCreditsExhausted(payload.email);
  }
}
