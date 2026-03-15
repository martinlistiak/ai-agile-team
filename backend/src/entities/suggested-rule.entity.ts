import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Space } from './space.entity';
import { Agent } from './agent.entity';
import { Execution } from './execution.entity';

@Entity('suggested_rules')
export class SuggestedRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  spaceId: string;

  @Column({ nullable: true })
  agentId: string;

  @Column({ nullable: true })
  executionId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text' })
  reasoning: string;

  /** 'pending' | 'accepted' | 'rejected' */
  @Column({ default: 'pending' })
  status: string;

  @Column({ default: 'agent' })
  suggestedScope: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Space, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'spaceId' })
  space: Space;

  @ManyToOne(() => Agent, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'agentId' })
  agent: Agent;

  @ManyToOne(() => Execution, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'executionId' })
  execution: Execution;
}
