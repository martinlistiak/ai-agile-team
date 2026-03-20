import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SpacesController } from "./spaces.controller";
import { SpacesService } from "./spaces.service";
import { Space } from "../entities/space.entity";
import { Agent } from "../entities/agent.entity";
import { TeamsModule } from "../teams/teams.module";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Space, Agent]),
    TeamsModule,
    BillingModule,
  ],
  controllers: [SpacesController],
  providers: [SpacesService],
  exports: [SpacesService],
})
export class SpacesModule {}
