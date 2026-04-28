import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import { Request, Response } from "express";
import { JwtOrApiKeyGuard } from "../auth/jwt-or-apikey.guard";
import { SubscriptionActiveGuard } from "../common/subscription-active.guard";
import { PlanGuard, RequirePlan } from "../billing/plan.guard";
import { SsoService } from "./sso.service";
import { AgentTrainingService } from "./agent-training.service";
import { SlaService } from "./sla.service";
import { AnalyticsService } from "./analytics.service";
import { AccessControlService } from "../common/access-control.service";

@ApiTags("Enterprise")
@Controller("enterprise")
export class EnterpriseController {
  constructor(
    private ssoService: SsoService,
    private trainingService: AgentTrainingService,
    private slaService: SlaService,
    private analyticsService: AnalyticsService,
    private accessControl: AccessControlService,
  ) {}

  // ── SSO / SAML ──

  @Post("sso/:teamId/configure")
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard, PlanGuard)
  @RequirePlan("enterprise")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Configure SSO/SAML for a team" })
  @ApiParam({ name: "teamId", format: "uuid" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        provider: { type: "string", enum: ["saml", "oidc"] },
        entityId: { type: "string" },
        ssoUrl: { type: "string" },
        certificate: { type: "string" },
        metadataUrl: { type: "string" },
        defaultRole: { type: "string" },
        enforceSSO: { type: "boolean" },
      },
      required: ["provider", "entityId", "ssoUrl", "certificate"],
    },
  })
  @ApiResponse({ status: 201, description: "SSO configuration saved" })
  async configureSso(
    @Req() req: Request,
    @Param("teamId") teamId: string,
    @Body()
    body: {
      provider: "saml" | "oidc";
      entityId: string;
      ssoUrl: string;
      certificate: string;
      metadataUrl?: string;
      defaultRole?: string;
      enforceSSO?: boolean;
    },
  ) {
    await this.accessControl.assertTeamAdminOrOwnerOrThrow(
      teamId,
      (req.user as any).id,
    );
    return this.ssoService.configureSso(teamId, body);
  }

  @Get("sso/:teamId")
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard, PlanGuard)
  @RequirePlan("enterprise")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get SSO configuration for a team" })
  @ApiParam({ name: "teamId", format: "uuid" })
  @ApiResponse({ status: 200, description: "SSO configuration" })
  async getSsoConfig(@Req() req: Request, @Param("teamId") teamId: string) {
    await this.accessControl.assertTeamMemberOrThrow(
      teamId,
      (req.user as any).id,
    );
    return this.ssoService.getSsoConfig(teamId);
  }

  @Delete("sso/:teamId")
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard, PlanGuard)
  @RequirePlan("enterprise")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Remove SSO configuration" })
  @ApiParam({ name: "teamId", format: "uuid" })
  @ApiResponse({ status: 200, description: "SSO removed" })
  async deleteSsoConfig(@Req() req: Request, @Param("teamId") teamId: string) {
    await this.accessControl.assertTeamAdminOrOwnerOrThrow(
      teamId,
      (req.user as any).id,
    );
    return { deleted: await this.ssoService.deleteSsoConfig(teamId) };
  }

  @Patch("sso/:teamId/toggle")
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard, PlanGuard)
  @RequirePlan("enterprise")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Enable or disable SSO" })
  @ApiParam({ name: "teamId", format: "uuid" })
  @ApiBody({
    schema: {
      type: "object",
      properties: { enabled: { type: "boolean" } },
      required: ["enabled"],
    },
  })
  async toggleSso(
    @Req() req: Request,
    @Param("teamId") teamId: string,
    @Body() body: { enabled: boolean },
  ) {
    await this.accessControl.assertTeamAdminOrOwnerOrThrow(
      teamId,
      (req.user as any).id,
    );
    return this.ssoService.toggleSso(teamId, body.enabled);
  }

  @Get("sso/:teamId/login")
  @ApiOperation({ summary: "Initiate SAML login for a team" })
  @ApiParam({ name: "teamId", format: "uuid" })
  @ApiResponse({ status: 302, description: "Redirects to IdP" })
  async initiateSamlLogin(
    @Param("teamId") teamId: string,
    @Res() res: Response,
  ) {
    const { redirectUrl } = await this.ssoService.initiateSamlLogin(teamId);
    res.redirect(redirectUrl);
  }

  @Post("sso/callback")
  @HttpCode(200)
  @ApiOperation({ summary: "Handle SAML callback from IdP" })
  @ApiResponse({ status: 200, description: "JWT token and user" })
  async handleSamlCallback(
    @Body() body: { SAMLResponse: string; RelayState: string },
  ) {
    return this.ssoService.handleSamlCallback(
      body.SAMLResponse,
      body.RelayState,
    );
  }

  @Get("sso/:teamId/metadata")
  @ApiOperation({ summary: "Get SAML SP metadata XML" })
  @ApiParam({ name: "teamId", format: "uuid" })
  @ApiResponse({ status: 200, description: "SAML metadata XML" })
  async getSpMetadata(@Param("teamId") teamId: string, @Res() res: Response) {
    const xml = await this.ssoService.getSpMetadata(teamId);
    res.type("application/xml").send(xml);
  }

  // ── Agent Training ──

  @Post("training/:agentId")
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard, PlanGuard)
  @RequirePlan("enterprise")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Create a training dataset for an agent" })
  @ApiParam({ name: "agentId", format: "uuid" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        documents: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fileName: { type: "string" },
              content: { type: "string" },
              mimeType: { type: "string" },
            },
          },
        },
      },
      required: ["name", "documents"],
    },
  })
  @ApiResponse({ status: 201, description: "Training created" })
  async createTraining(
    @Req() req: Request,
    @Param("agentId") agentId: string,
    @Body()
    body: {
      name: string;
      description?: string;
      documents: { fileName: string; content: string; mimeType: string }[];
    },
  ) {
    await this.accessControl.getAccessibleAgentOrThrow(agentId, (req.user as any).id);
    return this.trainingService.createTraining(agentId, body);
  }

  @Get("training/:agentId")
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard, PlanGuard)
  @RequirePlan("enterprise")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "List trainings for an agent" })
  @ApiParam({ name: "agentId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Array of trainings" })
  async getTrainings(@Req() req: Request, @Param("agentId") agentId: string) {
    await this.accessControl.getAccessibleAgentOrThrow(agentId, (req.user as any).id);
    return this.trainingService.getTrainings(agentId);
  }

  @Get("training/detail/:id")
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard, PlanGuard)
  @RequirePlan("enterprise")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get training details" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Training object" })
  async getTraining(@Req() req: Request, @Param("id") id: string) {
    await this.accessControl.getAccessibleTrainingOrThrow(id, (req.user as any).id);
    return this.trainingService.getTraining(id);
  }

  @Post("training/:id/apply")
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard, PlanGuard)
  @RequirePlan("enterprise")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Apply completed training to agent" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 201, description: "Updated agent" })
  async applyTraining(@Req() req: Request, @Param("id") id: string) {
    await this.accessControl.getAccessibleTrainingOrThrow(id, (req.user as any).id);
    return this.trainingService.applyTraining(id);
  }

  @Delete("training/:id")
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard, PlanGuard)
  @RequirePlan("enterprise")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Delete a training" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Deletion result" })
  async deleteTraining(@Req() req: Request, @Param("id") id: string) {
    await this.accessControl.getAccessibleTrainingOrThrow(id, (req.user as any).id);
    return { deleted: await this.trainingService.deleteTraining(id) };
  }

  // ── SLA Guarantee ──

  @Post("sla/:teamId/configure")
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard, PlanGuard)
  @RequirePlan("enterprise")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Configure SLA targets for a team" })
  @ApiParam({ name: "teamId", format: "uuid" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        uptimeTarget: { type: "number" },
        responseTimeMsTarget: { type: "number" },
        resolutionTimeHoursTarget: { type: "number" },
      },
    },
  })
  @ApiResponse({ status: 201, description: "SLA configuration saved" })
  async configureSla(
    @Req() req: Request,
    @Param("teamId") teamId: string,
    @Body()
    body: {
      uptimeTarget?: number;
      responseTimeMsTarget?: number;
      resolutionTimeHoursTarget?: number;
    },
  ) {
    await this.accessControl.assertTeamAdminOrOwnerOrThrow(
      teamId,
      (req.user as any).id,
    );
    return this.slaService.configureSla(teamId, body);
  }

  @Get("sla/:teamId")
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard, PlanGuard)
  @RequirePlan("enterprise")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get SLA status and compliance" })
  @ApiParam({ name: "teamId", format: "uuid" })
  @ApiResponse({ status: 200, description: "SLA status with compliance" })
  async getSlaStatus(@Req() req: Request, @Param("teamId") teamId: string) {
    await this.accessControl.assertTeamMemberOrThrow(
      teamId,
      (req.user as any).id,
    );
    return this.slaService.getSlaStatus(teamId);
  }

  @Get("sla/:teamId/history")
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard, PlanGuard)
  @RequirePlan("enterprise")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get SLA history over time" })
  @ApiParam({ name: "teamId", format: "uuid" })
  @ApiQuery({ name: "days", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Daily SLA metrics" })
  async getSlaHistory(
    @Req() req: Request,
    @Param("teamId") teamId: string,
    @Query("days") days?: string,
  ) {
    await this.accessControl.assertTeamMemberOrThrow(
      teamId,
      (req.user as any).id,
    );
    return this.slaService.getSlaHistory(
      teamId,
      parseInt(days ?? "30", 10) || 30,
    );
  }

  // ── Advanced Analytics ──

  @Get("analytics/:teamId/dashboard")
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard, PlanGuard)
  @RequirePlan("enterprise")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get advanced analytics dashboard" })
  @ApiParam({ name: "teamId", format: "uuid" })
  @ApiQuery({ name: "days", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Analytics dashboard data" })
  async getAnalyticsDashboard(
    @Req() req: Request,
    @Param("teamId") teamId: string,
    @Query("days") days?: string,
  ) {
    await this.accessControl.assertTeamMemberOrThrow(
      teamId,
      (req.user as any).id,
    );
    return this.analyticsService.getDashboard(
      teamId,
      parseInt(days ?? "30", 10) || 30,
    );
  }

  @Get("analytics/:teamId/events")
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard, PlanGuard)
  @RequirePlan("enterprise")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Get analytics event timeline" })
  @ApiParam({ name: "teamId", format: "uuid" })
  @ApiQuery({ name: "eventType", required: false })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Event timeline" })
  async getEventTimeline(
    @Req() req: Request,
    @Param("teamId") teamId: string,
    @Query("eventType") eventType?: string,
    @Query("limit") limit?: string,
  ) {
    await this.accessControl.assertTeamMemberOrThrow(
      teamId,
      (req.user as any).id,
    );
    return this.analyticsService.getEventTimeline(
      teamId,
      eventType,
      parseInt(limit ?? "50", 10) || 50,
    );
  }

  @Post("analytics/:teamId/track")
  @UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard, PlanGuard)
  @RequirePlan("enterprise")
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Track a custom analytics event" })
  @ApiParam({ name: "teamId", format: "uuid" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        eventType: { type: "string" },
        metadata: { type: "object" },
        spaceId: { type: "string" },
      },
      required: ["eventType"],
    },
  })
  @ApiResponse({ status: 201, description: "Event tracked" })
  async trackEvent(
    @Req() req: Request,
    @Param("teamId") teamId: string,
    @Body()
    body: {
      eventType: string;
      metadata?: Record<string, any>;
      spaceId?: string;
    },
  ) {
    await this.accessControl.assertTeamMemberOrThrow(
      teamId,
      (req.user as any).id,
    );
    const userId = (req.user as any)?.id;
    await this.analyticsService.trackEvent(
      teamId,
      body.eventType,
      body.metadata ?? {},
      userId,
      body.spaceId,
    );
    return { tracked: true };
  }
}
