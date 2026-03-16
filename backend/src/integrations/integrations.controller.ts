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
import { IntegrationsService } from "./integrations.service";
import { Request } from "express";

@ApiTags("Integrations")
@ApiBearerAuth("bearer")
@Controller("integrations")
@UseGuards(JwtOrApiKeyGuard)
export class IntegrationsController {
  constructor(private integrationsService: IntegrationsService) {}

  @Post("github/disconnect")
  @ApiOperation({ summary: "Disconnect GitHub account" })
  @ApiResponse({ status: 201, description: "GitHub disconnected" })
  async disconnectGithub(@Req() req: Request) {
    await this.integrationsService.disconnectGithub((req.user as any).id);
    return { ok: true };
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
