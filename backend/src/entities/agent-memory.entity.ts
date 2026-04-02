import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { Agent } from "./agent.entity";
import { Space } from "./space.entity";

/**
 * Episodic memory: cross-execution patterns learned by agents.
 * Memories with high confidence and frequent access are injected into system prompts.
 * Memories decay over time using Ebbinghaus-inspired forgetting curves.
 */
@Entity("agent_memories")
@Index(["spaceId", "agentId"])
export class AgentMemory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  spaceId: string;

  @Column()
  agentId: string;

  @Column({ nullable: true })
  executionId: string;

  @Column({ type: "text" })
  pattern: string;

  @Column({ type: "text" })
  lesson: string;

  @Column({ type: "varchar", default: "success" })
  outcome: string; // 'success' | 'failure' | 'mixed'

  @Column({ type: "float", default: 0.5 })
  confidence: number;

  @Column({ type: "int", default: 1 })
  accessCount: number;

  @Column({ type: "int", default: 1 })
  reinforceCount: number;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  lastAccessed: Date;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  lastReinforced: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Agent, { nullable: false })
  @JoinColumn({ name: "agentId" })
  agent: Agent;

  @ManyToOne(() => Space, { nullable: false })
  @JoinColumn({ name: "spaceId" })
  space: Space;
}
