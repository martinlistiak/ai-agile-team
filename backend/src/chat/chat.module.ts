import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { EventsGateway } from "./events.gateway";
import { AgentsModule } from "../agents/agents.module";
import { AuthModule } from "../auth/auth.module";
import { ChatMessage } from "../entities/chat-message.entity";
import { ChatAttachment } from "../entities/chat-attachment.entity";

@Module({
  imports: [
    forwardRef(() => AgentsModule),
    AuthModule,
    TypeOrmModule.forFeature([ChatMessage, ChatAttachment]),
  ],
  controllers: [ChatController],
  providers: [ChatService, EventsGateway],
  exports: [ChatService, EventsGateway],
})
export class ChatModule {}
