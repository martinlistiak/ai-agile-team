import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Space } from "../entities/space.entity";
import { Ticket } from "../entities/ticket.entity";
import { Agent } from "../entities/agent.entity";
import { Rule } from "../entities/rule.entity";
import { SuggestedRule } from "../entities/suggested-rule.entity";
import { ChatAttachment } from "../entities/chat-attachment.entity";
import { Team } from "../entities/team.entity";
import { TeamMember } from "../entities/team-member.entity";
import { AgentTraining } from "../entities/agent-training.entity";

@Injectable()
export class AccessControlService {
  constructor(
    @InjectRepository(Space) private spaceRepo: Repository<Space>,
    @InjectRepository(Ticket) private ticketRepo: Repository<Ticket>,
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
    @InjectRepository(Rule) private ruleRepo: Repository<Rule>,
    @InjectRepository(SuggestedRule)
    private suggestedRuleRepo: Repository<SuggestedRule>,
    @InjectRepository(ChatAttachment)
    private attachmentRepo: Repository<ChatAttachment>,
    @InjectRepository(Team) private teamRepo: Repository<Team>,
    @InjectRepository(TeamMember) private memberRepo: Repository<TeamMember>,
    @InjectRepository(AgentTraining)
    private trainingRepo: Repository<AgentTraining>,
  ) {}

  async getAccessibleSpaceOrThrow(
    spaceId: string,
    userId: string,
  ): Promise<Space> {
    const space = await this.spaceRepo.findOneBy({ id: spaceId });
    if (!space) {
      throw new NotFoundException("Space not found");
    }

    await this.assertCanAccessSpaceOwner(space.userId, userId);

    return space;
  }

  async getAccessibleTicketOrThrow(
    ticketId: string,
    userId: string,
  ): Promise<Ticket> {
    const ticket = await this.ticketRepo
      .createQueryBuilder("ticket")
      .innerJoinAndSelect("ticket.space", "space")
      .where("ticket.id = :ticketId", { ticketId })
      .getOne();

    if (!ticket) {
      throw new NotFoundException("Ticket not found");
    }

    await this.assertCanAccessSpaceOwner(ticket.space.userId, userId);

    return ticket;
  }

  async getAccessibleAgentOrThrow(
    agentId: string,
    userId: string,
  ): Promise<Agent> {
    const agent = await this.agentRepo
      .createQueryBuilder("agent")
      .innerJoinAndSelect("agent.space", "space")
      .where("agent.id = :agentId", { agentId })
      .getOne();

    if (!agent) {
      throw new NotFoundException("Agent not found");
    }

    await this.assertCanAccessSpaceOwner(agent.space.userId, userId);

    return agent;
  }

  async getAccessibleRuleOrThrow(ruleId: string, userId: string): Promise<Rule> {
    const rule = await this.ruleRepo
      .createQueryBuilder("rule")
      .innerJoinAndSelect("rule.space", "space")
      .where("rule.id = :ruleId", { ruleId })
      .getOne();

    if (!rule) {
      throw new NotFoundException("Rule not found");
    }

    await this.assertCanAccessSpaceOwner(rule.space.userId, userId);

    return rule;
  }

  async getAccessibleSuggestedRuleOrThrow(
    suggestedRuleId: string,
    userId: string,
  ): Promise<SuggestedRule> {
    const suggestion = await this.suggestedRuleRepo
      .createQueryBuilder("suggestion")
      .innerJoinAndSelect("suggestion.space", "space")
      .where("suggestion.id = :suggestedRuleId", { suggestedRuleId })
      .getOne();

    if (!suggestion) {
      throw new NotFoundException("Suggested rule not found");
    }

    await this.assertCanAccessSpaceOwner(suggestion.space.userId, userId);

    return suggestion;
  }

  async getAccessibleAttachmentOrThrow(
    attachmentId: string,
    userId: string,
  ): Promise<ChatAttachment> {
    const attachment = await this.attachmentRepo
      .createQueryBuilder("attachment")
      .innerJoinAndSelect("attachment.message", "message")
      .innerJoinAndSelect("message.space", "space")
      .where("attachment.id = :attachmentId", { attachmentId })
      .getOne();

    if (!attachment) {
      throw new NotFoundException("Chat attachment not found");
    }

    await this.assertCanAccessSpaceOwner(attachment.message.space.userId, userId);

    return attachment;
  }

  async getAccessibleTrainingOrThrow(
    trainingId: string,
    userId: string,
  ): Promise<AgentTraining> {
    const training = await this.trainingRepo
      .createQueryBuilder("training")
      .innerJoinAndSelect("training.agent", "agent")
      .innerJoinAndSelect("agent.space", "space")
      .where("training.id = :trainingId", { trainingId })
      .getOne();

    if (!training) {
      throw new NotFoundException("Training not found");
    }

    await this.assertCanAccessSpaceOwner(training.agent.space.userId, userId);

    return training;
  }

  async assertTicketInSpace(ticketId: string, spaceId: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOneBy({ id: ticketId, spaceId });
    if (!ticket) {
      throw new NotFoundException("Ticket not found in this space");
    }
    return ticket;
  }

  async assertTicketsInSpace(
    ticketIds: string[],
    spaceId: string,
  ): Promise<void> {
    for (const ticketId of new Set(ticketIds)) {
      await this.assertTicketInSpace(ticketId, spaceId);
    }
  }

  async assertAgentInSpace(agentId: string, spaceId: string): Promise<Agent> {
    const agent = await this.agentRepo.findOneBy({ id: agentId, spaceId });
    if (!agent) {
      throw new NotFoundException("Agent not found in this space");
    }
    return agent;
  }

  async assertUserCanBeAssignedToOwnedSpace(
    ownerId: string,
    assigneeUserId: string,
  ): Promise<void> {
    if (ownerId === assigneeUserId) {
      return;
    }

    const membershipCount = await this.memberRepo
      .createQueryBuilder("member")
      .innerJoin("member.team", "team")
      .where("member.userId = :assigneeUserId", { assigneeUserId })
      .andWhere("team.ownerId = :ownerId", { ownerId })
      .getCount();

    if (membershipCount === 0) {
      throw new BadRequestException(
        "Assigned user must belong to a team owned by this space owner",
      );
    }
  }

  async getTeamOrThrow(teamId: string): Promise<Team> {
    const team = await this.teamRepo.findOneBy({ id: teamId });
    if (!team) {
      throw new NotFoundException("Team not found");
    }
    return team;
  }

  async assertTeamMemberOrThrow(
    teamId: string,
    userId: string,
  ): Promise<TeamMember> {
    await this.getTeamOrThrow(teamId);
    const member = await this.memberRepo.findOneBy({ teamId, userId });
    if (!member) {
      throw new ForbiddenException("Not a member of this team");
    }
    return member;
  }

  async assertTeamAdminOrOwnerOrThrow(
    teamId: string,
    userId: string,
  ): Promise<TeamMember> {
    const member = await this.assertTeamMemberOrThrow(teamId, userId);
    if (member.role !== "owner" && member.role !== "admin") {
      throw new ForbiddenException("Requires admin or owner role");
    }
    return member;
  }

  private async assertCanAccessSpaceOwner(
    ownerId: string,
    userId: string,
  ): Promise<void> {
    if (ownerId === userId) {
      return;
    }

    const membershipCount = await this.memberRepo
      .createQueryBuilder("member")
      .innerJoin("member.team", "team")
      .where("member.userId = :userId", { userId })
      .andWhere("team.ownerId = :ownerId", { ownerId })
      .getCount();

    if (membershipCount === 0) {
      throw new NotFoundException("Resource not found");
    }
  }
}
