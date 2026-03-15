import { Module } from "@nestjs/common";
import { WebhooksController } from "./webhooks.controller";
import { SpacesModule } from "../spaces/spaces.module";
import { TicketsModule } from "../tickets/tickets.module";
import { ChatModule } from "../chat/chat.module";

@Module({
  imports: [SpacesModule, TicketsModule, ChatModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
