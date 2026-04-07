import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import { JwtOrApiKeyGuard } from "../auth/jwt-or-apikey.guard";
import { SubscriptionActiveGuard } from "../common/subscription-active.guard";
import { IntegrationsService } from "./integrations.service";
import { Request } from "express";

@ApiTags("Integrations")
@ApiBearerAuth("bearer")
@Controller("integrations")
@UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard)
export class IntegrationsController {
  constructor(private integrationsService: IntegrationsService) {}

  @Post("github/disconnect")
  @ApiOperation({ summary: "Disconnect GitHub account" })
  @ApiResponse({ status: 201, description: "GitHub disconnected" })
  async disconnectGithub(@Req() req: Request) {
    await this.integrationsService.disconnectGithub((req.user as any).id);
    return { ok: true };
  }

  @Post("github/reviewer-token")
  @ApiOperation({
    summary: "Save a separate GitHub PAT for the reviewer agent",
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: { token: { type: "string" } },
      required: ["token"],
    },
  })
  @ApiResponse({ status: 201, description: "Reviewer token saved" })
  async saveReviewerToken(
    @Req() req: Request,
    @Body() body: { token: string },
  ) {
    await this.integrationsService.saveReviewerToken(
      (req.user as any).id,
      body.token,
    );
    return { ok: true };
  }

  @Delete("github/reviewer-token")
  @ApiOperation({ summary: "Remove the reviewer GitHub token" })
  @ApiResponse({ status: 200, description: "Reviewer token removed" })
  async clearReviewerToken(@Req() req: Request) {
    await this.integrationsService.clearReviewerToken((req.user as any).id);
    return { ok: true };
  }

  @Get("github/reviewer-token/status")
  @ApiOperation({ summary: "Check if a reviewer token is configured" })
  @ApiResponse({ status: 200, description: "Reviewer token status" })
  async reviewerTokenStatus(@Req() req: Request) {
    const hasToken = await this.integrationsService.hasReviewerToken(
      (req.user as any).id,
    );
    return { configured: hasToken };
  }

  @Post("gitlab/disconnect")
  @ApiOperation({ summary: "Disconnect GitLab account" })
  @ApiResponse({ status: 201, description: "GitLab disconnected" })
  async disconnectGitlab(@Req() req: Request) {
    await this.integrationsService.disconnectGitlab((req.user as any).id);
    return { ok: true };
  }

  @Get("api-keys")
  @ApiOperation({ summary: "List all API keys" })
  @ApiResponse({
    status: 200,
    description: "Array of API keys (without raw key)",
  })
  async listApiKeys(@Req() req: Request) {
    return this.integrationsService.listApiKeys((req.user as any).id);
  }

  @Post("api-keys")
  @ApiOperation({ summary: "Create a new API key" })
  @ApiBody({
    schema: {
      type: "object",
      properties: { name: { type: "string", example: "CI/CD" } },
      required: ["name"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Created API key (raw key only shown once)",
  })
  async createApiKey(@Req() req: Request, @Body() body: { name: string }) {
    return this.integrationsService.createApiKey(
      (req.user as any).id,
      body.name,
    );
  }

  @Delete("api-keys/:id")
  @ApiOperation({ summary: "Revoke an API key" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "API key revoked" })
  async revokeApiKey(@Req() req: Request, @Param("id") id: string) {
    await this.integrationsService.revokeApiKey((req.user as any).id, id);
    return { ok: true };
  }
}
