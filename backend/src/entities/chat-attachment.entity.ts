import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ChatMessage } from './chat-message.entity';

@Entity('chat_attachments')
export class ChatAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  messageId: string;

  @Column({ type: 'text' })
  fileName: string;

  @Column({ type: 'text' })
  mimeType: string;

  @Column({ type: 'int' })
  byteSize: number;

  @Column({ type: 'bytea' })
  data: Buffer;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => ChatMessage, (message) => message.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: ChatMessage;
}
