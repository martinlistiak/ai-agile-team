import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PmAgentService } from '../agents/pm-agent.service';
import { DeveloperAgentService } from '../agents/developer-agent.service';
import { TesterAgentService } from '../agents/tester-agent.service';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatAttachment } from '../entities/chat-attachment.entity';

type AgentType = 'pm' | 'developer' | 'tester';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private pmAgentService: PmAgentService,
    private developerAgentService: DeveloperAgentService,
    private testerAgentService: TesterAgentService,
    @InjectRepository(ChatMessage) private messageRepo: Repository<ChatMessage>,
    @InjectRepository(ChatAttachment) private attachmentRepo: Repository<ChatAttachment>,
  ) {}

  async listMessages(spaceId: string) {
    const messages = await this.messageRepo.find({
      where: { spaceId },
      relations: { attachments: true },
      order: { createdAt: 'ASC' },
    });

    return messages.map((message) => this.toMessageResponse(message));
  }

  async getAttachmentOrThrow(attachmentId: string): Promise<ChatAttachment> {
    const attachment = await this.attachmentRepo.findOneBy({ id: attachmentId });
    if (!attachment) {
      throw new NotFoundException('Chat attachment not found');
    }
    return attachment;
  }

  async sendMessage(
    spaceId: string,
    message: string,
    files: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }>,
    agentType: AgentType = 'pm',
    ticketId?: string,
  ): Promise<ChatMessage> {
    const trimmedMessage = message.trim();
    const imageFiles = (files ?? []).filter((file) => file.mimetype.startsWith('image/'));

    if (!trimmedMessage && imageFiles.length === 0) {
      throw new BadRequestException('Message or image is required');
    }

    if (files.length > 0 && files.length !== imageFiles.length) {
      throw new BadRequestException('Only image attachments are supported');
    }

    try {
      this.logger.log(`Processing message for space ${spaceId} via ${agentType} agent`);

      const userMessage = this.messageRepo.create({
        spaceId,
        role: 'user',
        content: trimmedMessage,
      });
      await this.messageRepo.save(userMessage);

      if (imageFiles.length > 0) {
        const attachments = imageFiles.map((file) => this.attachmentRepo.create({
          messageId: userMessage.id,
          fileName: file.originalname,
          mimeType: file.mimetype,
          byteSize: file.size,
          data: file.buffer,
        }));
        await this.attachmentRepo.save(attachments);
        userMessage.attachments = attachments;
      } else {
        userMessage.attachments = [];
      }

      // Route to the correct agent
      let response: string;

      switch (agentType) {
        case 'developer':
          response = await this.developerAgentService.run(spaceId, trimmedMessage, ticketId);
          break;
        case 'tester':
          response = await this.testerAgentService.run(spaceId, trimmedMessage, ticketId);
          break;
        case 'pm':
        default:
          response = await this.pmAgentService.run(
            spaceId,
            trimmedMessage,
            userMessage.attachments.map((attachment) => ({
              fileName: attachment.fileName,
              mimeType: attachment.mimeType,
              data: attachment.data,
            })),
          );
          break;
      }

      const assistantMessage = this.messageRepo.create({
        spaceId,
        role: 'assistant',
        content: response,
        agentType,
      });
      await this.messageRepo.save(assistantMessage);
      assistantMessage.attachments = [];

      return assistantMessage;
    } catch (error) {
      this.logger.error('Chat error:', error);
      throw error;
    }
  }

  private toMessageResponse(message: ChatMessage) {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      timestamp: message.createdAt.toISOString(),
      agentType: message.agentType ?? undefined,
      attachments: (message.attachments ?? []).map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        byteSize: attachment.byteSize,
        isImage: attachment.mimeType.startsWith('image/'),
        url: `/api/chat/attachments/${attachment.id}/content`,
      })),
    };
  }
}
