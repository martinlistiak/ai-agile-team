import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BullModule } from "@nestjs/bull";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { RequestLoggingMiddleware } from "./common/request-logging.middleware";
import { SpacesModule } from "./spaces/spaces.module";
import { TicketsModule } from "./tickets/tickets.module";
import { AgentsModule } from "./agents/agents.module";
import { ChatModule } from "./chat/chat.module";
import { RulesModule } from "./rules/rules.module";
import { PipelineModule } from "./pipeline/pipeline.module";
import { CommonModule } from "./common/common.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { HealthModule } from "./health/health.module";
import { BillingModule } from "./billing/billing.module";
import { TeamsModule } from "./teams/teams.module";
import { IntegrationsModule } from "./integrations/integrations.module";
import { User } from "./entities/user.entity";
import { Space } from "./entities/space.entity";
import { Agent } from "./entities/agent.entity";
import { Ticket } from "./entities/ticket.entity";
import { Execution } from "./entities/execution.entity";
import { ChatMessage } from "./entities/chat-message.entity";
import { ChatAttachment } from "./entities/chat-attachment.entity";
import { Rule } from "./entities/rule.entity";
import { SuggestedRule } from "./entities/suggested-rule.entity";
import { Team } from "./entities/team.entity";
import { TeamMember } from "./entities/team-member.entity";
import { TeamInvitation } from "./entities/team-invitation.entity";
import { ApiKey } from "./entities/api-key.entity";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 100 }],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        host: config.get("DATABASE_HOST", "localhost"),
        port: config.get<number>("DATABASE_PORT", 5432),
        username: config.get("DATABASE_USER", "runa"),
        password: config.get("DATABASE_PASSWORD", "runa"),
        database: config.get("DATABASE_NAME", "runa"),
        entities: [
          User,
          Space,
          Agent,
          Ticket,
          Execution,
          ChatMessage,
          ChatAttachment,
          Rule,
          SuggestedRule,
          Team,
          TeamMember,
          TeamInvitation,
          ApiKey,
        ],
        synchronize: config.get("NODE_ENV") !== "production",
        migrations: [__dirname + "/migrations/*{.ts,.js}"],
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: config.get("REDIS_URL", "redis://localhost:6379"),
      }),
    }),
    AuthModule,
    CommonModule,
    SpacesModule,
    TicketsModule,
    AgentsModule,
    ChatModule,
    RulesModule,
    PipelineModule,
    WebhooksModule,
    HealthModule,
    BillingModule,
    TeamsModule,
    IntegrationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes("*");
  }
}
