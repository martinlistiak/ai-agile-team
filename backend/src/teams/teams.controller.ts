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
import { CreateTeamDto } from "./dto/create-team.dto";
import { InviteMemberDto } from "./dto/invite-member.dto";
import { UpdateMemberRoleDto } from "./dto/update-member-role.dto";

@ApiTags("Teams")
@ApiBearerAuth("bearer")
@Controller("teams")
@UseGuards(JwtOrApiKeyGuard)
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new team" })
  @ApiResponse({ status: 201, description: "Created team" })
  async create(@Req() req: Request, @Body() body: CreateTeamDto) {
    return this.teamsService.createTeam((req.user as any).id, body.name);
  }

  @Get()
  @ApiOperation({ summary: "List teams for the current user" })
  @ApiResponse({ status: 200, description: "Array of teams" })
  async findAll(@Req() req: Request) {
    return this.teamsService.getTeamsForUser((req.user as any).id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get team details with members" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Team with members" })
  async findOne(@Req() req: Request, @Param("id") id: string) {
    return this.teamsService.getTeamWithMembers(id, (req.user as any).id);
  }

  @Post(":id/invitations")
  @ApiOperation({ summary: "Invite a member by email" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 201, description: "Invitation created" })
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
  @ApiOperation({ summary: "Revoke a pending invitation" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiParam({ name: "invitationId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Invitation revoked" })
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
  @ApiOperation({ summary: "Remove a team member" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiParam({ name: "memberId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Member removed" })
  async removeMember(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
  ) {
    await this.teamsService.removeMember(id, memberId, (req.user as any).id);
    return { removed: true };
  }

  @Patch(":id/members/:memberId/role")
  @ApiOperation({ summary: "Update a member's role" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiParam({ name: "memberId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Role updated" })
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

  @Get(":id/seats")
  @ApiOperation({ summary: "Get seat count and usage" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Seat count info" })
  async getSeats(@Req() req: Request, @Param("id") id: string) {
    return this.teamsService.getSeatCount(id, (req.user as any).id);
  }
}
