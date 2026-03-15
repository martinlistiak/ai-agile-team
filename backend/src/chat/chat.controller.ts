import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ChatService } from "./chat.service";
import { SendChatMessageDto } from "./dto/send-chat-message.dto";
import { Response } from "express";

@Controller("chat")
@UseGuards(AuthGuard("jwt"))
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get(":spaceId/messages")
  async listMessages(@Param("spaceId") spaceId: string) {
    return this.chatService.listMessages(spaceId);
  }

  @Get("attachments/:attachmentId/content")
  async attachmentContent(
    @Param("attachmentId") attachmentId: string,
    @Res() res: Response,
  ) {
    const attachment =
      await this.chatService.getAttachmentOrThrow(attachmentId);
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Length", attachment.byteSize.toString());
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${attachment.fileName}"`,
    );
    res.send(attachment.data);
  }

  @Post(":spaceId/send")
  @UseInterceptors(FilesInterceptor("images", 6))
  async send(
    @Param("spaceId") spaceId: string,
    @Body() body: SendChatMessageDto,
    @UploadedFiles()
    files: Array<{
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    }> = [],
  ) {
    const assistantMessage = await this.chatService.sendMessage(
      spaceId,
      body.message ?? "",
      files,
      (body.agentType as any) ?? "pm",
      body.ticketId,
    );
    return {
      response: assistantMessage.content,
      assistantMessage: {
        id: assistantMessage.id,
        role: assistantMessage.role,
        content: assistantMessage.content,
        timestamp: assistantMessage.createdAt.toISOString(),
        agentType: assistantMessage.agentType ?? undefined,
        attachments: [],
      },
    };
  }
}
