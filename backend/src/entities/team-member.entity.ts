import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from "typeorm";
import { Team } from "./team.entity";
import { User } from "./user.entity";

export type TeamRole = "owner" | "admin" | "member";

@Entity("team_members")
@Unique(["teamId", "userId"])
export class TeamMember {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  teamId: string;

  @Column()
  userId: string;

  @Column({ type: "text", default: "member" })
  role: TeamRole;

  @CreateDateColumn()
  joinedAt: Date;

  @ManyToOne(() => Team, (t) => t.members, { onDelete: "CASCADE" })
  @JoinColumn({ name: "teamId" })
  team: Team;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;
}
