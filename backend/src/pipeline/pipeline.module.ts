import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { PipelineListener } from './pipeline.listener';
import { Space } from '../entities/space.entity';
import { Ticket } from '../entities/ticket.entity';
import { AgentsModule } from '../agents/agents.module';
import { RulesModule } from '../rules/rules.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Space, Ticket]),
    AgentsModule,
    RulesModule,
    ChatModule,
  ],
  controllers: [PipelineController],
  providers: [PipelineService, PipelineListener],
  exports: [PipelineService],
})
export class PipelineModule {}
