import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Team } from "./team.entity";
import { User } from "./user.entity";

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

@Entity("team_invitations")
export class TeamInvitation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  teamId: string;

  @Column()
  email: string;

  @Column()
  invitedById: string;

  @Column({ type: "text", default: "member" })
  role: string;

  @Column({ type: "text", unique: true })
  token: string;

  @Column({ type: "text", default: "pending" })
  status: InvitationStatus;

  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Team, (t) => t.invitations, { onDelete: "CASCADE" })
  @JoinColumn({ name: "teamId" })
  team: Team;

  @ManyToOne(() => User)
  @JoinColumn({ name: "invitedById" })
  invitedBy: User;
}
