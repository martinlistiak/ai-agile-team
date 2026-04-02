import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationsController } from "./notifications.controller";
import { ContactController } from "./contact.controller";
import { NotificationsService } from "./notifications.service";
import { NotificationsListener } from "./notifications.listener";
import { SlackService } from "./slack.service";
import { Notification } from "../entities/notification.entity";
import { NotificationPreference } from "../entities/notification-preference.entity";
import { User } from "../entities/user.entity";
import { Space } from "../entities/space.entity";
import { TeamMember } from "../entities/team-member.entity";
import { TeamsModule } from "../teams/teams.module";
import { ChatModule } from "../chat/chat.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      User,
      Space,
      TeamMember,
    ]),
    TeamsModule,
    ChatModule,
  ],
  controllers: [NotificationsController, ContactController],
  providers: [NotificationsService, NotificationsListener, SlackService],
  exports: [NotificationsService, SlackService],
})
export class NotificationsModule {}
