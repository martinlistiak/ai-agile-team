import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Team } from "./team.entity";

export type SsoProvider = "saml" | "oidc";

@Entity("sso_configs")
export class SsoConfig {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  teamId: string;

  @Column({ type: "text", default: "saml" })
  provider: SsoProvider;

  @Column({ type: "text" })
  entityId: string;

  @Column({ type: "text" })
  ssoUrl: string;

  @Column({ type: "text" })
  certificate: string;

  @Column({ type: "text", nullable: true })
  metadataUrl: string;

  @Column({ type: "text", nullable: true })
  defaultRole: string;

  @Column({ default: false })
  enforceSSO: boolean;

  @Column({ default: true })
  enabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Team, { onDelete: "CASCADE" })
  @JoinColumn({ name: "teamId" })
  team: Team;
}
