import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  HttpCode,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { JwtOrApiKeyGuard } from "../auth/jwt-or-apikey.guard";

@ApiTags("notifications")
@ApiBearerAuth()
@UseGuards(JwtOrApiKeyGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "unreadOnly", required: false })
  async getNotifications(
    @Req() req: any,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("unreadOnly") unreadOnly?: string,
  ) {
    return this.notificationsService.getNotifications(req.user.id, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      unreadOnly: unreadOnly === "true",
    });
  }

  @Patch(":id/read")
  @HttpCode(200)
  async markAsRead(@Req() req: any, @Param("id") id: string) {
    const success = await this.notificationsService.markAsRead(req.user.id, id);
    return { success };
  }

  @Patch("read-all")
  @HttpCode(200)
  async markAllAsRead(@Req() req: any) {
    const count = await this.notificationsService.markAllAsRead(req.user.id);
    return { markedRead: count };
  }

  @Delete(":id")
  async deleteNotification(@Req() req: any, @Param("id") id: string) {
    const success = await this.notificationsService.deleteNotification(
      req.user.id,
      id,
    );
    return { success };
  }

  // --- Preferences ---

  @Get("preferences")
  async getPreferences(@Req() req: any) {
    return this.notificationsService.getOrCreatePreferences(req.user.id);
  }

  @Patch("preferences")
  async updatePreferences(@Req() req: any, @Body() body: Record<string, any>) {
    // Strip fields that shouldn't be user-editable
    const { id, userId, user, ...updates } = body;
    return this.notificationsService.updatePreferences(req.user.id, updates);
  }
}
