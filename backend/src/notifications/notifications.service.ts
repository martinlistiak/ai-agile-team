import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import {
  Notification,
  NotificationType,
} from "../entities/notification.entity";
import {
  NotificationPreference,
  EmailDigestFrequency,
} from "../entities/notification-preference.entity";
import { User } from "../entities/user.entity";
import { MailService } from "../teams/mail.service";
import { EventsGateway } from "../chat/events.gateway";

export interface CreateNotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  spaceId?: string;
}

/** Maps notification type → preference field names */
const PREF_MAP: Record<
  NotificationType,
  { inApp: keyof NotificationPreference; email: keyof NotificationPreference }
> = {
  agent_completed: {
    inApp: "inAppAgentCompleted",
    email: "emailAgentCompleted",
  },
  agent_failed: { inApp: "inAppAgentFailed", email: "emailAgentFailed" },
  pipeline_stage_changed: {
    inApp: "inAppPipelineStageChanged",
    email: "emailPipelineStageChanged",
  },
  pr_created: { inApp: "inAppPrCreated", email: "emailPrCreated" },
  ticket_assigned: {
    inApp: "inAppTicketAssigned",
    email: "emailTicketAssigned",
  },
  ticket_commented: {
    inApp: "inAppTicketCommented",
    email: "emailTicketCommented",
  },
  team_invitation: {
    inApp: "inAppTeamInvitation",
    email: "emailTeamInvitation",
  },
  team_member_joined: {
    inApp: "inAppTeamMemberJoined",
    email: "emailTeamMemberJoined",
  },
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private prefRepo: Repository<NotificationPreference>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private mailService: MailService,
    private eventsGateway: EventsGateway,
  ) {}

  /** Create an in-app notification and optionally send email based on user prefs. */
  async notify(
    payload: CreateNotificationPayload,
  ): Promise<Notification | null> {
    const prefs = await this.getOrCreatePreferences(payload.userId);

    if (prefs.muteAll) return null;

    const prefKeys = PREF_MAP[payload.type];
    if (!prefKeys) {
      this.logger.warn(`Unknown notification type: ${payload.type}`);
      return null;
    }

    const wantsInApp = prefs[prefKeys.inApp] as boolean;
    const wantsEmail = prefs[prefKeys.email] as boolean;

    if (!wantsInApp && !wantsEmail) return null;

    let notification: Notification | null = null;

    if (wantsInApp) {
      notification = this.notificationRepo.create({
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        relatedEntityId: payload.relatedEntityId ?? null,
        relatedEntityType: payload.relatedEntityType ?? null,
        spaceId: payload.spaceId ?? null,
      });
      notification = await this.notificationRepo.save(notification);

      // Push via WebSocket to user room
      this.eventsGateway.emitNotification(payload.userId, notification);
    }

    if (wantsEmail && prefs.emailDigestFrequency === "instant") {
      await this.sendNotificationEmail(payload);
      if (notification) {
        notification.emailSent = true;
        await this.notificationRepo.save(notification);
      }
    }

    return notification;
  }

  /** Notify multiple users at once (e.g. all space members). */
  async notifyMany(
    userIds: string[],
    payload: Omit<CreateNotificationPayload, "userId">,
  ): Promise<void> {
    await Promise.allSettled(
      userIds.map((userId) => this.notify({ ...payload, userId })),
    );
  }

  async getNotifications(
    userId: string,
    opts: { page?: number; limit?: number; unreadOnly?: boolean } = {},
  ): Promise<{ data: Notification[]; total: number; unreadCount: number }> {
    const page = opts.page ?? 1;
    const limit = Math.min(opts.limit ?? 30, 100);

    const where: any = { userId };
    if (opts.unreadOnly) where.read = false;

    const [data, total] = await this.notificationRepo.findAndCount({
      where,
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const unreadCount = await this.notificationRepo.count({
      where: { userId, read: false },
    });

    return { data, total, unreadCount };
  }

  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.notificationRepo.update(
      { id: notificationId, userId },
      { read: true },
    );
    return (result.affected ?? 0) > 0;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.notificationRepo.update(
      { userId, read: false },
      { read: true },
    );
    return result.affected ?? 0;
  }

  async deleteNotification(
    userId: string,
    notificationId: string,
  ): Promise<boolean> {
    const result = await this.notificationRepo.delete({
      id: notificationId,
      userId,
    });
    return (result.affected ?? 0) > 0;
  }

  async clearOldNotifications(daysOld: number = 90): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    const result = await this.notificationRepo.delete({
      createdAt: LessThan(cutoff),
    });
    return result.affected ?? 0;
  }

  // --- Preferences ---

  async getOrCreatePreferences(
    userId: string,
  ): Promise<NotificationPreference> {
    let prefs = await this.prefRepo.findOneBy({ userId });
    if (!prefs) {
      prefs = this.prefRepo.create({ userId });
      prefs = await this.prefRepo.save(prefs);
    }
    return prefs;
  }

  async updatePreferences(
    userId: string,
    updates: Partial<Omit<NotificationPreference, "id" | "userId" | "user">>,
  ): Promise<NotificationPreference> {
    const prefs = await this.getOrCreatePreferences(userId);
    Object.assign(prefs, updates);
    return this.prefRepo.save(prefs);
  }

  // --- Email dispatch ---

  private async sendNotificationEmail(
    payload: CreateNotificationPayload,
  ): Promise<void> {
    try {
      const user = await this.userRepo.findOneBy({ id: payload.userId });
      if (!user) return;

      await this.mailService.sendNotificationEmail({
        to: user.email,
        userName: user.name,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        relatedEntityId: payload.relatedEntityId,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send notification email for user ${payload.userId}`,
        err,
      );
    }
  }
}
