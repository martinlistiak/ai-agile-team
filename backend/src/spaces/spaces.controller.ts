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
  ForbiddenException,
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
import { SpacesService } from "./spaces.service";
import { TeamsService } from "../teams/teams.service";
import { CreateSpaceDto } from "./dto/create-space.dto";
import { UpdateSpaceDto } from "./dto/update-space.dto";
import { Request } from "express";

@ApiTags("Spaces")
@ApiBearerAuth("bearer")
@Controller("spaces")
@UseGuards(JwtOrApiKeyGuard)
export class SpacesController {
  constructor(
    private spacesService: SpacesService,
    private teamsService: TeamsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List all spaces for the current user" })
  @ApiResponse({ status: 200, description: "Array of spaces" })
  async findAll(@Req() req: Request) {
    return this.spacesService.findAllByUser((req.user as any).id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single space by ID" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Space object" })
  async findOne(@Param("id") id: string) {
    return this.spacesService.findById(id);
  }

  @Get(":id/assignable-users")
  @ApiOperation({ summary: "List users who can be assigned to tickets" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Array of assignable users" })
  async getAssignableUsers(@Param("id") id: string) {
    const space = await this.spacesService.findById(id);
    return this.teamsService.getAssignableUsersForUser(space.userId);
  }

  @Post()
  @ApiOperation({ summary: "Create a new space" })
  @ApiResponse({ status: 201, description: "Created space" })
  @ApiResponse({ status: 403, description: "Starter plan limited to 1 space" })
  async create(@Req() req: Request, @Body() body: CreateSpaceDto) {
    const user = req.user as any;
    const existingSpaces = await this.spacesService.findAllByUser(user.id);
    const planTier = user.planTier ?? "starter";

    if (planTier === "starter" && existingSpaces.length >= 1) {
      throw new ForbiddenException(
        "Starter plan is limited to 1 space. Upgrade to Team for unlimited spaces.",
      );
    }

    return this.spacesService.create(user.id, body);
  }

  @Post("reorder")
  @ApiOperation({ summary: "Reorder spaces in the sidebar" })
  @ApiBody({
    schema: {
      type: "object",
      properties: { orderedIds: { type: "array", items: { type: "string" } } },
      required: ["orderedIds"],
    },
  })
  @ApiResponse({ status: 201, description: "Reorder successful" })
  async reorder(@Req() req: Request, @Body() body: { orderedIds: string[] }) {
    await this.spacesService.reorder((req.user as any).id, body.orderedIds);
    return { success: true };
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update space settings" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Updated space" })
  async update(@Param("id") id: string, @Body() body: UpdateSpaceDto) {
    return this.spacesService.update(id, body);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a space and all its data" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Space deleted" })
  async remove(@Param("id") id: string) {
    await this.spacesService.delete(id);
    return { deleted: true };
  }
}
