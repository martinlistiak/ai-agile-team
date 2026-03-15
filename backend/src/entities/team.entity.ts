import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";
import { TeamMember } from "./team-member.entity";
import { TeamInvitation } from "./team-invitation.entity";

@Entity("teams")
export class Team {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column()
  ownerId: string;

  @Column({ type: "int", default: 1 })
  seatCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: "ownerId" })
  owner: User;

  @OneToMany(() => TeamMember, (m) => m.team)
  members: TeamMember[];

  @OneToMany(() => TeamInvitation, (i) => i.team)
  invitations: TeamInvitation[];
}
