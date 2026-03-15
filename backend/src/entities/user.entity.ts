import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { Space } from "./space.entity";

export type PlanTier = "starter" | "team" | "enterprise";
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "none";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  hashedPassword: string;

  @Column({ type: "bigint", nullable: true, unique: true })
  githubId: number;

  @Column({ type: "text", nullable: true })
  githubTokenEncrypted: string;

  @Column({ type: "bigint", nullable: true, unique: true })
  gitlabId: number;

  @Column({ type: "text", nullable: true })
  gitlabTokenEncrypted: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ type: "text", nullable: true, unique: true })
  stripeCustomerId: string;

  @Column({ type: "text", nullable: true })
  stripeSubscriptionId: string;

  @Column({ type: "text", default: "starter" })
  planTier: PlanTier;

  @Column({ type: "text", default: "none" })
  subscriptionStatus: SubscriptionStatus;

  @Column({ type: "timestamptz", nullable: true })
  currentPeriodEnd: Date;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Space, (space) => space.user)
  spaces: Space[];
}
