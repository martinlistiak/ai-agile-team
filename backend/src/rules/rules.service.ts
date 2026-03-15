import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rule } from '../entities/rule.entity';

@Injectable()
export class RulesService {
  constructor(
    @InjectRepository(Rule) private ruleRepo: Repository<Rule>,
  ) {}

  async findBySpace(spaceId: string): Promise<Rule[]> {
    return this.ruleRepo.find({
      where: { spaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByAgent(agentId: string): Promise<Rule[]> {
    return this.ruleRepo.find({
      where: { agentId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveRulesForAgent(spaceId: string, agentId: string): Promise<Rule[]> {
    // Return both space-level and agent-specific rules
    return this.ruleRepo
      .createQueryBuilder('rule')
      .where('rule.spaceId = :spaceId', { spaceId })
      .andWhere('rule.isActive = true')
      .andWhere('(rule.scope = :spaceScope OR (rule.scope = :agentScope AND rule.agentId = :agentId) OR rule.scope = :crossScope)', {
        spaceScope: 'space',
        agentScope: 'agent',
        agentId,
        crossScope: 'cross-team',
      })
      .orderBy('rule.scope', 'ASC')
      .addOrderBy('rule.createdAt', 'DESC')
      .getMany();
  }

  async findById(id: string): Promise<Rule> {
    const rule = await this.ruleRepo.findOneBy({ id });
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }

  async create(data: {
    spaceId: string;
    agentId?: string;
    scope: string;
    content: string;
  }): Promise<Rule> {
    const rule = this.ruleRepo.create({
      spaceId: data.spaceId,
      agentId: data.agentId ?? undefined,
      scope: data.scope,
      content: data.content,
    });
    return this.ruleRepo.save(rule);
  }

  async update(id: string, data: { content?: string; isActive?: boolean }): Promise<Rule> {
    const rule = await this.findById(id);
    if (data.content !== undefined && data.content !== rule.content) {
      rule.version += 1;
      rule.content = data.content;
    }
    if (data.isActive !== undefined) {
      rule.isActive = data.isActive;
    }
    return this.ruleRepo.save(rule);
  }

  async delete(id: string): Promise<void> {
    await this.ruleRepo.delete(id);
  }

  /**
   * Compile all active rules into a single text block for an agent's system prompt.
   */
  async compileRulesForAgent(spaceId: string, agentId: string): Promise<string> {
    const rules = await this.findActiveRulesForAgent(spaceId, agentId);
    if (rules.length === 0) return '';

    const sections: string[] = [];

    const spaceRules = rules.filter(r => r.scope === 'space');
    if (spaceRules.length > 0) {
      sections.push('## Space Rules\n' + spaceRules.map(r => `- ${r.content}`).join('\n'));
    }

    const agentRules = rules.filter(r => r.scope === 'agent');
    if (agentRules.length > 0) {
      sections.push('## Agent Rules\n' + agentRules.map(r => `- ${r.content}`).join('\n'));
    }

    const crossTeamRules = rules.filter(r => r.scope === 'cross-team');
    if (crossTeamRules.length > 0) {
      sections.push('## Cross-Team Rules\n' + crossTeamRules.map(r => `- ${r.content}`).join('\n'));
    }

    return sections.join('\n\n');
  }
}
