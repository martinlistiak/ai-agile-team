import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";
import { Ticket } from "../entities/ticket.entity";
import { Execution } from "../entities/execution.entity";
import { Space } from "../entities/space.entity";
import { PipelineModule } from "../pipeline/pipeline.module";
import { AgentsModule } from "../agents/agents.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, Execution, Space]),
    forwardRef(() => PipelineModule),
    forwardRef(() => AgentsModule),
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
