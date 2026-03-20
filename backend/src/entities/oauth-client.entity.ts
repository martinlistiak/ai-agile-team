import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity("oauth_clients")
export class OAuthClient {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  clientId: string;

  @Column({ type: "text", nullable: true })
  clientSecret: string;

  @Column({ type: "text", nullable: true })
  clientName: string;

  @Column({ type: "simple-array" })
  redirectUris: string[];

  @Column({ type: "simple-array", default: "authorization_code,refresh_token" })
  grantTypes: string[];

  @Column({ type: "text", default: "code" })
  responseTypes: string;

  @Column({ type: "text", default: "none" })
  tokenEndpointAuthMethod: string;

  @CreateDateColumn()
  createdAt: Date;
}
