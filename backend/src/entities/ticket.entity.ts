import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Space } from "./space.entity";
import { Agent } from "./agent.entity";

@Entity("tickets")
export class Ticket {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  spaceId: string;

  @Column()
  title: string;

  @Column({ type: "text", default: "" })
  description: string;

  @Column({ default: "backlog" })
  status: string;

  @Column({ default: "medium" })
  priority: string;

  @Column({ nullable: true })
  assigneeAgentId: string;

  @Column({ type: "jsonb", default: [] })
  comments: any[];

  @Column({ type: "jsonb", default: [] })
  statusHistory: Array<{
    from: string;
    to: string;
    timestamp: string;
    trigger: "user" | "agent" | "pipeline";
  }>;

  @Column({ type: "text", nullable: true })
  prUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Space, (space) => space.tickets)
  @JoinColumn({ name: "spaceId" })
  space: Space;

  @ManyToOne(() => Agent, { nullable: true })
  @JoinColumn({ name: "assigneeAgentId" })
  assigneeAgent: Agent;
}
