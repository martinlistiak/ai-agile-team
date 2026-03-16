import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import Redis from "ioredis";

@ApiTags("Health")
@SkipThrottle()
@Controller("health")
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject("HEALTH_REDIS_CLIENT") private readonly redis: Redis,
  ) {}

  @Get()
  @ApiOperation({ summary: "Check API, database, and Redis status" })
  @ApiResponse({ status: 200, description: "All services healthy" })
  @ApiResponse({ status: 503, description: "One or more services down" })
  async check() {
    let dbStatus: "up" | "down" = "down";
    let redisStatus: "up" | "down" = "down";

    try {
      await this.dataSource.query("SELECT 1");
      dbStatus = "up";
    } catch {
      dbStatus = "down";
    }

    try {
      const result = await this.redis.ping();
      redisStatus = result === "PONG" ? "up" : "down";
    } catch {
      redisStatus = "down";
    }

    const healthy = dbStatus === "up" && redisStatus === "up";
    const body = {
      status: healthy ? ("ok" as const) : ("error" as const),
      db: dbStatus,
      redis: redisStatus,
    };

    if (!healthy) {
      throw new HttpException(body, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return body;
  }
}
