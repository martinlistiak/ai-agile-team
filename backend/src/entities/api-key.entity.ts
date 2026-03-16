import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity("api_keys")
export class ApiKey {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @Column()
  name: string;

  /** Only the first 8 chars are stored for display; full key is hashed */
  @Column()
  prefix: string;

  @Column()
  hashedKey: string;

  @Column({ type: "text", nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
