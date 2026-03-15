import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { SuggestedRulesService } from './suggested-rules.service';
import { Rule } from '../entities/rule.entity';
import { SuggestedRule } from '../entities/suggested-rule.entity';
import { Execution } from '../entities/execution.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Rule, SuggestedRule, Execution])],
  controllers: [RulesController],
  providers: [RulesService, SuggestedRulesService],
  exports: [RulesService, SuggestedRulesService],
})
export class RulesModule {}
