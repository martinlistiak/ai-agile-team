import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Agent } from "./agent.entity";
import { Ticket } from "./ticket.entity";

@Entity("executions")
export class Execution {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  agentId: string;

  @Column({ nullable: true })
  ticketId: string;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  startTime: Date;

  @Column({ type: "timestamp", nullable: true })
  endTime: Date;

  @Column({ default: "running" })
  status: string;

  @Column({ type: "jsonb", default: [] })
  actionLog: any[];

  @Column({ type: "int", default: 0 })
  tokensUsed: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Agent, (agent) => agent.executions)
  @JoinColumn({ name: "agentId" })
  agent: Agent;

  @ManyToOne(() => Ticket, { nullable: true })
  @JoinColumn({ name: "ticketId" })
  ticket: Ticket;
}
