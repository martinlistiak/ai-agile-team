import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Agent } from "./agent.entity";

export type TrainingStatus = "pending" | "processing" | "completed" | "failed";

@Entity("agent_trainings")
export class AgentTraining {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  agentId: string;

  @Column({ type: "text" })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "text", default: "pending" })
  status: TrainingStatus;

  @Column({ type: "jsonb", default: [] })
  documents: { fileName: string; content: string; mimeType: string }[];

  @Column({ type: "text", nullable: true })
  compiledContext: string;

  @Column({ type: "int", default: 0 })
  documentCount: number;

  @Column({ type: "text", nullable: true })
  errorMessage: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Agent, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agentId" })
  agent: Agent;
}
