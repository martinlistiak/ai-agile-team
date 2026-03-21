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

  @Column({ type: "text", nullable: true })
  avatarUrl: string | null;

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

  /** Usage credits balance in cents. Topped up via one-time payments. */
  @Column({ type: "int", default: 0 })
  creditsBalance: number;

  @Column({ type: "text", nullable: true })
  ssoProvider: string;

  @Column({ type: "text", nullable: true })
  ssoExternalId: string;

  @Column({ type: "timestamptz", nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  termsAcceptedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  privacyAcceptedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Space, (space) => space.user)
  spaces: Space[];
}
