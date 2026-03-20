import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("analytics_events")
@Index(["teamId", "createdAt"])
@Index(["eventType", "createdAt"])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  teamId: string;

  @Column({ nullable: true })
  userId: string;

  @Column({ nullable: true })
  spaceId: string;

  @Column({ type: "text" })
  eventType: string;

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
