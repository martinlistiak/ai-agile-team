import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
} from "@nestjs/swagger";
import { Request } from "express";
import { JwtOrApiKeyGuard } from "../auth/jwt-or-apikey.guard";
import { SubscriptionActiveGuard } from "../common/subscription-active.guard";
import { CountlyService } from "../common/countly.service";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ChatService } from "./chat.service";
import { SendChatMessageDto } from "./dto/send-chat-message.dto";
import { AgentsService } from "../agents/agents.service";
import { Response } from "express";

@ApiTags("Chat")
@ApiBearerAuth("bearer")
@Controller("chat")
@UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard)
export class ChatController {
  constructor(
    private chatService: ChatService,
    private agentsService: AgentsService,
    private countly: CountlyService,
  ) {}

  @Get(":spaceId/messages")
  @ApiOperation({
    summary: "List chat messages in a space, optionally filtered by agent",
  })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Array of chat messages" })
  async listMessages(
    @Param("spaceId") spaceId: string,
    @Query("agentType") agentType?: string,
  ) {
    return this.chatService.listMessages(spaceId, agentType);
  }

  @Get("attachments/:attachmentId/content")
  @ApiOperation({ summary: "Download a chat attachment" })
  @ApiParam({ name: "attachmentId", format: "uuid" })
  @ApiResponse({ status: 200, description: "File content" })
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
  @UseInterceptors(FilesInterceptor("files", 6))
  @ApiOperation({
    summary: "Send a message to an agent (supports image and PDF attachments)",
  })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 201, description: "Assistant response message" })
  async send(
    @Req() req: Request,
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

    const userId = (req.user as { id?: string })?.id;
    if (userId) {
      const agentType = (body.agentType as string) ?? "pm";
      this.countly.record(userId, "chat_message_sent", {
        agent_type: agentType,
        has_attachments: files.length > 0 ? "true" : "false",
        has_ticket_ref: body.ticketId ? "true" : "false",
      });
    }

    // Extract created ticket IDs from the latest execution's action log
    let createdTickets: Array<{ ticketId: string; title: string }> = [];
    if (body.agentType === "pm" || !body.agentType) {
      const agents = await this.agentsService.findBySpace(spaceId);
      const pmAgent = agents.find((a) => a.agentType === "pm");
      if (pmAgent) {
        const executions = await this.agentsService.getExecutionsByAgent(
          pmAgent.id,
          1,
          1,
        );
        const latest = executions.data[0];
        if (latest?.actionLog) {
          createdTickets = latest.actionLog
            .filter(
              (entry: any) =>
                entry.tool === "create_ticket" && entry.result?.success,
            )
            .map((entry: any) => ({
              ticketId: entry.result.ticketId,
              title: entry.result.title,
            }));
        }
      }
    }

    return {
      response: assistantMessage.content,
      createdTickets,
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
