import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Request } from "express";
import { TeamsService } from "./teams.service";
import { CreateTeamDto } from "./dto/create-team.dto";
import { InviteMemberDto } from "./dto/invite-member.dto";
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto";

@Controller("teams")
@UseGuards(AuthGuard("jwt"))
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  @Post()
  async create(@Req() req: Request, @Body() body: CreateTeamDto) {
    return this.teamsService.createTeam((req.user as any).id, body.name);
  }

  @Get()
  async findAll(@Req() req: Request) {
    return this.teamsService.getTeamsForUser((req.user as any).id);
  }

  @Get(":id")
  async findOne(@Req() req: Request, @Param("id") id: string) {
    return this.teamsService.getTeamWithMembers(id, (req.user as any).id);
  }

  @Post(":id/invitations")
  async invite(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: InviteMemberDto,
  ) {
    return this.teamsService.inviteMember(
      id,
      (req.user as any).id,
      body.email,
      body.role,
    );
  }

  @Delete(":id/invitations/:invitationId")
  async revokeInvitation(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("invitationId") invitationId: string,
  ) {
    await this.teamsService.revokeInvitation(
      id,
      invitationId,
      (req.user as any).id,
    );
    return { revoked: true };
  }

  @Delete(":id/members/:memberId")
  async removeMember(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
  ) {
    await this.teamsService.removeMember(id, memberId, (req.user as any).id);
    return { removed: true };
  }

  @Patch(":id/members/:memberId/role")
  async updateRole(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
    @Body() body: UpdateMemberRoleDto,
  ) {
    return this.teamsService.updateMemberRole(
      id,
      memberId,
      body.role,
      (req.user as any).id,
    );
  }

  @Patch(":id/seats")
  async updateSeats(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: { seatCount: number },
  ) {
    return this.teamsService.updateSeatCount(
      id,
      body.seatCount,
      (req.user as any).id,
    );
  }
}
