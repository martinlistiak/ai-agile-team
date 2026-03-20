import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("oauth_codes")
export class OAuthCode {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  clientId: string;

  @Column()
  userId: string;

  @Column({ type: "text" })
  redirectUri: string;

  @Column({ type: "text", nullable: true })
  codeChallenge: string;

  @Column({ type: "text", nullable: true })
  codeChallengeMethod: string;

  @Column({ type: "text", default: "openid" })
  scope: string;

  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @Column({ default: false })
  used: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
