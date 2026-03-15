import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Space } from './space.entity';
import { Execution } from './execution.entity';

@Entity('agents')
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  spaceId: string;

  @Column({ default: 'pm' })
  agentType: string;

  @Column({ type: 'text', nullable: true })
  rules: string;

  @Column({ default: 'pm_default.png' })
  avatarRef: string;

  @Column({ default: 'idle' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Space, (space) => space.agents)
  @JoinColumn({ name: 'spaceId' })
  space: Space;

  @OneToMany(() => Execution, (execution) => execution.agent)
  executions: Execution[];
}
