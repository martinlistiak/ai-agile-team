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
import { SubscriptionActiveGuard } from "../common/subscription-active.guard";
import { SpacesService } from "./spaces.service";
import { TeamsService } from "../teams/teams.service";
import { CreateSpaceDto } from "./dto/create-space.dto";
import { UpdateSpaceDto } from "./dto/update-space.dto";
import { Request } from "express";
import { CountlyService } from "../common/countly.service";
import { BillingService } from "../billing/billing.service";
import { AccessControlService } from "../common/access-control.service";

@ApiTags("Spaces")
@ApiBearerAuth("bearer")
@Controller("spaces")
@UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard)
export class SpacesController {
  constructor(
    private spacesService: SpacesService,
    private teamsService: TeamsService,
    private countly: CountlyService,
    private billingService: BillingService,
    private accessControl: AccessControlService,
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
  async findOne(@Req() req: Request, @Param("id") id: string) {
    return this.accessControl.getAccessibleSpaceOrThrow(id, (req.user as any).id);
  }

  @Get(":id/assignable-users")
  @ApiOperation({ summary: "List users who can be assigned to tickets" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Array of assignable users" })
  async getAssignableUsers(@Req() req: Request, @Param("id") id: string) {
    const space = await this.accessControl.getAccessibleSpaceOrThrow(
      id,
      (req.user as any).id,
    );
    return this.teamsService.getAssignableUsersForOwner(space.userId);
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

    const space = await this.spacesService.create(user.id, body);
    this.countly.record(user.id, "space_created", {
      has_github: body.githubRepoUrl ? "true" : "false",
      has_gitlab: body.gitlabRepoUrl ? "true" : "false",
    });

    // Update Stripe subscription quantity based on space count
    const allSpaces = await this.spacesService.findAllByUser(user.id);
    try {
      await this.billingService.updateSubscriptionQuantity(
        user.id,
        allSpaces.length,
      );
    } catch (err) {
      // Non-fatal: space is created, billing update can be retried
    }

    return space;
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
  async update(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: UpdateSpaceDto,
  ) {
    await this.accessControl.getAccessibleSpaceOrThrow(id, (req.user as any).id);
    return this.spacesService.update(id, body);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a space and all its data" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Space deleted" })
  async remove(@Req() req: Request, @Param("id") id: string) {
    await this.accessControl.getAccessibleSpaceOrThrow(id, (req.user as any).id);
    await this.spacesService.delete(id);

    // Update Stripe subscription quantity based on remaining space count
    const userId = (req.user as any).id;
    const remainingSpaces = await this.spacesService.findAllByUser(userId);
    try {
      await this.billingService.updateSubscriptionQuantity(
        userId,
        Math.max(remainingSpaces.length, 1),
      );
    } catch (err) {
      // Non-fatal: space is deleted, billing update can be retried
    }

    return { deleted: true };
  }
}
