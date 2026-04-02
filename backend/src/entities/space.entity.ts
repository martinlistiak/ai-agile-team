import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { Agent } from "./agent.entity";
import { Ticket } from "./ticket.entity";

@Entity("spaces")
export class Space {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  githubRepoUrl: string;

  @Column({ type: "text", nullable: true })
  gitlabRepoUrl: string;

  @Column({ type: "text", nullable: true })
  githubTokenRef: string;

  @Column({
    type: "jsonb",
    default: {
      development: true,
      review: true,
      testing: true,
      staged: true,
    },
  })
  pipelineConfig: Record<string, boolean>;

  @Column({ type: "text", nullable: true })
  crossTeamRules: string;

  @Column({ type: "int", default: 0, name: "order" })
  order: number;

  @Column({ type: "text", nullable: true })
  color: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.spaces)
  @JoinColumn({ name: "userId" })
  user: User;

  @OneToMany(() => Agent, (agent) => agent.space)
  agents: Agent[];

  @OneToMany(() => Ticket, (ticket) => ticket.space)
  tickets: Ticket[];
}
