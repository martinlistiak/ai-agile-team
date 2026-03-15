import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { HealthController } from "./health.controller";

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: "HEALTH_REDIS_CLIENT",
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get("REDIS_URL", "redis://localhost:6379");
        return new Redis(redisUrl);
      },
    },
  ],
})
export class HealthModule {}
