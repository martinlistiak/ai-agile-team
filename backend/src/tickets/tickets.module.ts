import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";
import { Ticket } from "../entities/ticket.entity";
import { Execution } from "../entities/execution.entity";
import { PipelineModule } from "../pipeline/pipeline.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, Execution]),
    forwardRef(() => PipelineModule),
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}
