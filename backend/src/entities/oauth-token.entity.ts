import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("oauth_tokens")
export class OAuthToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  accessToken: string;

  @Column({ type: "text", unique: true, nullable: true })
  refreshToken: string;

  @Column()
  clientId: string;

  @Column()
  userId: string;

  @Column({ type: "text", default: "openid" })
  scope: string;

  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  refreshExpiresAt: Date;

  @Column({ default: false })
  revoked: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
