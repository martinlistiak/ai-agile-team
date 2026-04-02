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
import { User } from "./user.entity";

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

  @Column({ nullable: true })
  assigneeUserId: string;

  @Column({ type: "jsonb", default: [] })
  comments: any[];

  @Column({ type: "jsonb", default: [] })
  statusHistory: Array<{
    from: string;
    to: string;
    timestamp: string;
    trigger: "user" | "agent" | "pipeline" | "mention";
    actorId?: string;
    actorName?: string;
    actorType?: "user" | "agent";
  }>;

  @Column({ type: "text", nullable: true })
  prUrl: string;

  @Column({ type: "integer", default: 0 })
  order: number;

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

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "assigneeUserId" })
  assigneeUser: User;
}
