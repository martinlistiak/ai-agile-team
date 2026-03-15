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
import { AuthGuard } from "@nestjs/passport";
import { SpacesService } from "./spaces.service";
import { CreateSpaceDto } from "./dto/create-space.dto";
import { UpdateSpaceDto } from "./dto/update-space.dto";
import { Request } from "express";

@Controller("spaces")
@UseGuards(AuthGuard("jwt"))
export class SpacesController {
  constructor(private spacesService: SpacesService) {}

  @Get()
  async findAll(@Req() req: Request) {
    return this.spacesService.findAllByUser((req.user as any).id);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.spacesService.findById(id);
  }

  @Post()
  async create(@Req() req: Request, @Body() body: CreateSpaceDto) {
    // Enforce space limit for starter plan
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
  async reorder(@Req() req: Request, @Body() body: { orderedIds: string[] }) {
    await this.spacesService.reorder((req.user as any).id, body.orderedIds);
    return { success: true };
  }

  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: UpdateSpaceDto) {
    return this.spacesService.update(id, body);
  }

  @Delete(":id")
  async remove(@Param("id") id: string) {
    await this.spacesService.delete(id);
    return { deleted: true };
  }
}
