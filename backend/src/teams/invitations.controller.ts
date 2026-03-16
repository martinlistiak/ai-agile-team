import { Controller, Get, Post, Param, Req, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { JwtOrApiKeyGuard } from "../auth/jwt-or-apikey.guard";
import { Request } from "express";
import { TeamsService } from "./teams.service";

@ApiTags("Invitations")
@Controller("invitations")
export class InvitationsController {
  constructor(private teamsService: TeamsService) {}

  @Get(":token")
  @ApiOperation({ summary: "Get invitation details by token" })
  @ApiParam({ name: "token" })
  @ApiResponse({ status: 200, description: "Invitation details" })
  async getInvitation(@Param("token") token: string) {
    return this.teamsService.getInvitationByToken(token);
  }

  @Post(":token/accept")
  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth("bearer")
  @ApiOperation({ summary: "Accept a team invitation" })
  @ApiParam({ name: "token" })
  @ApiResponse({ status: 201, description: "Invitation accepted" })
  async accept(@Param("token") token: string, @Req() req: Request) {
    return this.teamsService.acceptInvitation(token, (req.user as any).id);
  }
}
