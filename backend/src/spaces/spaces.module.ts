import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpacesController } from './spaces.controller';
import { SpacesService } from './spaces.service';
import { Space } from '../entities/space.entity';
import { Agent } from '../entities/agent.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Space, Agent])],
  controllers: [SpacesController],
  providers: [SpacesService],
  exports: [SpacesService],
})
export class SpacesModule {}
