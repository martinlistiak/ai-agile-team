import { Controller, Get, Post, Param, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request } from "express";
import { TeamsService } from "./teams.service";

@Controller("invitations")
export class InvitationsController {
  constructor(private teamsService: TeamsService) {}

  @Get(":token")
  async getInvitation(@Param("token") token: string) {
    return this.teamsService.getInvitationByToken(token);
  }

  @Post(":token/accept")
  @UseGuards(AuthGuard("jwt"))
  async accept(@Param("token") token: string, @Req() req: Request) {
    return this.teamsService.acceptInvitation(token, (req.user as any).id);
  }
}
