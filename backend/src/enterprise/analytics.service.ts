import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AnalyticsEvent } from "../entities/analytics-event.entity";
import { Execution } from "../entities/execution.entity";
import { Agent } from "../entities/agent.entity";
import { Ticket } from "../entities/ticket.entity";
import { Space } from "../entities/space.entity";
import { TeamMember } from "../entities/team-member.entity";

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(AnalyticsEvent)
    private eventRepo: Repository<AnalyticsEvent>,
    @InjectRepository(Execution) private executionRepo: Repository<Execution>,
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
    @InjectRepository(Ticket) private ticketRepo: Repository<Ticket>,
    @InjectRepository(Space) private spaceRepo: Repository<Space>,
    @InjectRepository(TeamMember) private memberRepo: Repository<TeamMember>,
  ) {}

  async trackEvent(
    teamId: string,
    eventType: string,
    metadata: Record<string, any> = {},
    userId?: string,
    spaceId?: string,
  ): Promise<void> {
    await this.eventRepo.save(
      this.eventRepo.create({ teamId, eventType, metadata, userId, spaceId }),
    );
  }

  async getDashboard(teamId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      overview,
      executionsByDay,
      agentPerformance,
      ticketVelocity,
      topSpaces,
      teamActivity,
    ] = await Promise.all([
      this.getOverview(since),
      this.getExecutionsByDay(since),
      this.getAgentPerformance(since),
      this.getTicketVelocity(since),
      this.getTopSpaces(since),
      this.getTeamActivity(teamId, since),
    ]);

    return {
      overview,
      executionsByDay,
      agentPerformance,
      ticketVelocity,
      topSpaces,
      teamActivity,
    };
  }

  async getEventTimeline(
    teamId: string,
    eventType?: string,
    limit: number = 50,
  ): Promise<AnalyticsEvent[]> {
    const qb = this.eventRepo
      .createQueryBuilder("e")
      .where("e.teamId = :teamId", { teamId })
      .orderBy("e.createdAt", "DESC")
      .limit(limit);
    if (eventType) qb.andWhere("e.eventType = :eventType", { eventType });
    return qb.getMany();
  }

  private async getOverview(since: Date) {
    const execStats = await this.executionRepo
      .createQueryBuilder("e")
      .select("COUNT(*)", "total")
      .addSelect(
        "COUNT(CASE WHEN e.status = 'completed' THEN 1 END)",
        "completed",
      )
      .addSelect("COUNT(CASE WHEN e.status = 'failed' THEN 1 END)", "failed")
      .addSelect(
        "AVG(EXTRACT(EPOCH FROM (e.endTime - e.startTime)) * 1000)",
        "avgMs",
      )
      .where("e.startTime >= :since", { since })
      .getRawOne();

    const activeAgents = await this.agentRepo
      .createQueryBuilder("a")
      .select("COUNT(DISTINCT a.id)", "count")
      .innerJoin("a.executions", "e")
      .where("e.startTime >= :since", { since })
      .getRawOne();

    const ticketStats = await this.ticketRepo
      .createQueryBuilder("t")
      .select("COUNT(*)", "total")
      .addSelect("COUNT(CASE WHEN t.status = 'done' THEN 1 END)", "done")
      .where("t.createdAt >= :since", { since })
      .getRawOne();

    const total = Number(execStats?.total) || 0;
    const completed = Number(execStats?.completed) || 0;

    return {
      totalExecutions: total,
      successRate: total > 0 ? (completed / total) * 100 : 0,
      avgExecutionTimeMs: Math.round(Number(execStats?.avgMs) || 0),
      activeAgents: Number(activeAgents?.count) || 0,
      totalTickets: Number(ticketStats?.total) || 0,
      ticketsCompleted: Number(ticketStats?.done) || 0,
    };
  }

  private async getExecutionsByDay(since: Date) {
    const results = await this.executionRepo
      .createQueryBuilder("e")
      .select("DATE(e.startTime)", "date")
      .addSelect("COUNT(*)", "count")
      .addSelect(
        "COUNT(CASE WHEN e.status = 'completed' THEN 1 END)",
        "success",
      )
      .addSelect("COUNT(CASE WHEN e.status = 'failed' THEN 1 END)", "failed")
      .where("e.startTime >= :since", { since })
      .groupBy("DATE(e.startTime)")
      .orderBy("date", "ASC")
      .getRawMany();
    return results.map((r: any) => ({
      date: r.date,
      count: Number(r.count),
      success: Number(r.success),
      failed: Number(r.failed),
    }));
  }

  private async getAgentPerformance(since: Date) {
    const results = await this.executionRepo
      .createQueryBuilder("e")
      .innerJoin("e.agent", "a")
      .select("a.agentType", "agentType")
      .addSelect("COUNT(*)", "executions")
      .addSelect(
        "COUNT(CASE WHEN e.status = 'completed' THEN 1 END)",
        "completed",
      )
      .addSelect(
        "AVG(EXTRACT(EPOCH FROM (e.endTime - e.startTime)) * 1000)",
        "avgMs",
      )
      .where("e.startTime >= :since", { since })
      .groupBy("a.agentType")
      .getRawMany();
    return results.map((r: any) => ({
      agentType: r.agentType,
      executions: Number(r.executions),
      successRate:
        Number(r.executions) > 0
          ? (Number(r.completed) / Number(r.executions)) * 100
          : 0,
      avgTimeMs: Math.round(Number(r.avgMs) || 0),
    }));
  }

  private async getTicketVelocity(since: Date) {
    const results = await this.ticketRepo
      .createQueryBuilder("t")
      .select("DATE(t.createdAt)", "date")
      .addSelect("COUNT(*)", "created")
      .addSelect("COUNT(CASE WHEN t.status = 'done' THEN 1 END)", "completed")
      .where("t.createdAt >= :since", { since })
      .groupBy("DATE(t.createdAt)")
      .orderBy("date", "ASC")
      .getRawMany();
    return results.map((r: any) => ({
      date: r.date,
      created: Number(r.created),
      completed: Number(r.completed),
    }));
  }

  private async getTopSpaces(since: Date) {
    const results = await this.executionRepo
      .createQueryBuilder("e")
      .innerJoin("e.agent", "a")
      .innerJoin("a.space", "s")
      .select("s.id", "spaceId")
      .addSelect("s.name", "spaceName")
      .addSelect("COUNT(*)", "executions")
      .where("e.startTime >= :since", { since })
      .groupBy("s.id")
      .addGroupBy("s.name")
      .orderBy("executions", "DESC")
      .limit(10)
      .getRawMany();
    return results.map((r: any) => ({
      spaceId: r.spaceId,
      spaceName: r.spaceName,
      executions: Number(r.executions),
    }));
  }

  private async getTeamActivity(teamId: string, since: Date) {
    const results = await this.eventRepo
      .createQueryBuilder("e")
      .select("e.userId", "userId")
      .addSelect("COUNT(*)", "actions")
      .where("e.teamId = :teamId", { teamId })
      .andWhere("e.createdAt >= :since", { since })
      .andWhere("e.userId IS NOT NULL")
      .groupBy("e.userId")
      .orderBy("actions", "DESC")
      .getRawMany();
    return results.map((r: any) => ({
      userId: r.userId,
      actions: Number(r.actions),
    }));
  }
}
