import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SlaConfig } from "../entities/sla-config.entity";
import { Execution } from "../entities/execution.entity";

@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    @InjectRepository(SlaConfig) private slaRepo: Repository<SlaConfig>,
    @InjectRepository(Execution) private executionRepo: Repository<Execution>,
  ) {}

  async configureSla(
    teamId: string,
    config: {
      uptimeTarget?: number;
      responseTimeMsTarget?: number;
      resolutionTimeHoursTarget?: number;
    },
  ): Promise<SlaConfig> {
    let sla = await this.slaRepo.findOneBy({ teamId });
    if (sla) {
      Object.assign(sla, config);
    } else {
      sla = this.slaRepo.create({ teamId, ...config });
    }
    return this.slaRepo.save(sla);
  }

  async getSlaStatus(teamId: string): Promise<{
    config: SlaConfig;
    compliance: {
      uptimeCompliant: boolean;
      responseTimeCompliant: boolean;
      resolutionTimeCompliant: boolean;
      overallCompliant: boolean;
    };
  }> {
    const config = await this.slaRepo.findOneBy({ teamId });
    if (!config)
      throw new NotFoundException("SLA not configured for this team");

    // Refresh metrics
    await this.refreshMetrics(teamId);
    const refreshed = await this.slaRepo.findOneBy({ teamId });

    const uptimeCompliant =
      Number(refreshed!.currentUptime) >= Number(refreshed!.uptimeTarget);
    const responseTimeCompliant =
      refreshed!.avgResponseTimeMs <= refreshed!.responseTimeMsTarget;
    const resolutionRate =
      refreshed!.totalIncidents > 0
        ? refreshed!.resolvedIncidents / refreshed!.totalIncidents
        : 1;
    const resolutionTimeCompliant = resolutionRate >= 0.95;

    return {
      config: refreshed!,
      compliance: {
        uptimeCompliant,
        responseTimeCompliant,
        resolutionTimeCompliant,
        overallCompliant:
          uptimeCompliant && responseTimeCompliant && resolutionTimeCompliant,
      },
    };
  }

  async getSlaHistory(
    teamId: string,
    days: number = 30,
  ): Promise<
    { date: string; uptime: number; avgResponseMs: number; incidents: number }[]
  > {
    const config = await this.slaRepo.findOneBy({ teamId });
    if (!config) throw new NotFoundException("SLA not configured");

    // Generate daily SLA metrics from execution data
    const since = new Date();
    since.setDate(since.getDate() - days);

    const results = await this.executionRepo
      .createQueryBuilder("e")
      .select("DATE(e.startTime)", "date")
      .addSelect("COUNT(*)", "total")
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
      .groupBy("DATE(e.startTime)")
      .orderBy("date", "ASC")
      .getRawMany();

    return results.map((r) => ({
      date: r.date,
      uptime: r.total > 0 ? (Number(r.completed) / Number(r.total)) * 100 : 100,
      avgResponseMs: Math.round(Number(r.avgMs) || 0),
      incidents: Number(r.failed) || 0,
    }));
  }

  private async refreshMetrics(teamId: string): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stats = await this.executionRepo
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
      .where("e.startTime >= :since", { since: thirtyDaysAgo })
      .getRawOne();

    const total = Number(stats?.total) || 0;
    const completed = Number(stats?.completed) || 0;
    const failed = Number(stats?.failed) || 0;
    const avgMs = Math.round(Number(stats?.avgMs) || 0);

    await this.slaRepo.update(
      { teamId },
      {
        currentUptime: total > 0 ? (completed / total) * 100 : 100,
        avgResponseTimeMs: avgMs,
        totalIncidents: failed,
        resolvedIncidents: completed,
        lastCheckedAt: new Date(),
      },
    );
  }
}
