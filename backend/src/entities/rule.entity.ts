import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Space } from './space.entity';
import { Agent } from './agent.entity';

@Entity('rules')
export class Rule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  spaceId: string;

  @Column({ nullable: true })
  agentId: string;

  /** 'space' = applies to all agents, 'agent' = specific agent, 'cross-team' = cross-space */
  @Column({ default: 'space' })
  scope: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 1 })
  version: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Space, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'spaceId' })
  space: Space;

  @ManyToOne(() => Agent, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'agentId' })
  agent: Agent;
}
