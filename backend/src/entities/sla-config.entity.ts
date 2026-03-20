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

@Entity("sla_configs")
export class SlaConfig {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  teamId: string;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 99.9 })
  uptimeTarget: number;

  @Column({ type: "int", default: 500 })
  responseTimeMsTarget: number;

  @Column({ type: "int", default: 4 })
  resolutionTimeHoursTarget: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 100 })
  currentUptime: number;

  @Column({ type: "int", default: 0 })
  avgResponseTimeMs: number;

  @Column({ type: "int", default: 0 })
  totalIncidents: number;

  @Column({ type: "int", default: 0 })
  resolvedIncidents: number;

  @Column({ type: "timestamptz", nullable: true })
  lastCheckedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Team, { onDelete: "CASCADE" })
  @JoinColumn({ name: "teamId" })
  team: Team;
}
