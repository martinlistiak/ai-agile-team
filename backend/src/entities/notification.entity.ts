import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";

export type NotificationType =
  | "agent_completed"
  | "agent_failed"
  | "pipeline_stage_changed"
  | "pr_created"
  | "ticket_assigned"
  | "ticket_commented"
  | "team_invitation"
  | "team_member_joined";

@Entity("notifications")
@Index(["userId", "read"])
@Index(["userId", "createdAt"])
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column({ type: "text" })
  type: NotificationType;

  @Column()
  title: string;

  @Column({ type: "text" })
  message: string;

  @Column({ type: "text", nullable: true })
  relatedEntityId: string | null;

  @Column({ type: "text", nullable: true })
  relatedEntityType: string | null;

  @Column({ type: "text", nullable: true })
  spaceId: string | null;

  @Column({ type: "boolean", default: false })
  read: boolean;

  @Column({ type: "boolean", default: false })
  emailSent: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
}
