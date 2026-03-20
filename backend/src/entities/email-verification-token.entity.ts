import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity("email_verification_tokens")
export class EmailVerificationToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("uuid")
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "varchar", length: 64, unique: true })
  tokenHash: string;

  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
