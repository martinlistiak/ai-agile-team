import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { User } from "./user.entity";

export type EmailDigestFrequency = "instant" | "hourly" | "daily" | "none";

@Entity("notification_preferences")
@Unique(["userId"])
export class NotificationPreference {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  // In-app notification toggles
  @Column({ type: "boolean", default: true })
  inAppAgentCompleted: boolean;

  @Column({ type: "boolean", default: true })
  inAppAgentFailed: boolean;

  @Column({ type: "boolean", default: true })
  inAppPipelineStageChanged: boolean;

  @Column({ type: "boolean", default: true })
  inAppPrCreated: boolean;

  @Column({ type: "boolean", default: true })
  inAppTicketAssigned: boolean;

  @Column({ type: "boolean", default: true })
  inAppTicketCommented: boolean;

  @Column({ type: "boolean", default: true })
  inAppTeamInvitation: boolean;

  @Column({ type: "boolean", default: true })
  inAppTeamMemberJoined: boolean;

  // Email notification toggles
  @Column({ type: "boolean", default: false })
  emailAgentCompleted: boolean;

  @Column({ type: "boolean", default: true })
  emailAgentFailed: boolean;

  @Column({ type: "boolean", default: false })
  emailPipelineStageChanged: boolean;

  @Column({ type: "boolean", default: true })
  emailPrCreated: boolean;

  @Column({ type: "boolean", default: false })
  emailTicketAssigned: boolean;

  @Column({ type: "boolean", default: false })
  emailTicketCommented: boolean;

  @Column({ type: "boolean", default: true })
  emailTeamInvitation: boolean;

  @Column({ type: "boolean", default: false })
  emailTeamMemberJoined: boolean;

  // Digest frequency for non-instant emails
  @Column({ type: "text", default: "instant" })
  emailDigestFrequency: EmailDigestFrequency;

  // Global mute
  @Column({ type: "boolean", default: false })
  muteAll: boolean;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
}
