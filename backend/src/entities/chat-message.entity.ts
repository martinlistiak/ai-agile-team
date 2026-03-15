import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Space } from './space.entity';
import { ChatAttachment } from './chat-attachment.entity';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  spaceId: string;

  @Column({ type: 'text' })
  role: 'user' | 'assistant';

  @Column({ type: 'text', default: '' })
  content: string;

  @Column({ type: 'text', nullable: true })
  agentType: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Space, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'spaceId' })
  space: Space;

  @OneToMany(() => ChatAttachment, (attachment) => attachment.message, { cascade: true })
  attachments: ChatAttachment[];
}
