import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { SubscriptionActiveGuard } from "../common/subscription-active.guard";
import { PlanGuard, RequirePlan } from "../billing/plan.guard";
import { RulesService } from "./rules.service";
import { SuggestedRulesService } from "./suggested-rules.service";
import { CreateRuleDto } from "./dto/create-rule.dto";
import { UpdateRuleDto } from "./dto/update-rule.dto";
import { Request } from "express";
import { Req } from "@nestjs/common";
import { AccessControlService } from "../common/access-control.service";

@ApiTags("Rules")
@ApiBearerAuth("bearer")
@Controller()
@UseGuards(JwtOrApiKeyGuard, SubscriptionActiveGuard)
export class RulesController {
  constructor(
    private rulesService: RulesService,
    private suggestedRulesService: SuggestedRulesService,
    private accessControl: AccessControlService,
  ) {}

  @Get("spaces/:spaceId/rules")
  @ApiOperation({ summary: "List all rules in a space" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Array of rules" })
  async listRules(@Req() req: Request, @Param("spaceId") spaceId: string) {
    await this.accessControl.getAccessibleSpaceOrThrow(spaceId, (req.user as any).id);
    return this.rulesService.findBySpace(spaceId);
  }

  @Post("spaces/:spaceId/rules")
  @UseGuards(PlanGuard)
  @RequirePlan("team", "enterprise")
  @ApiOperation({ summary: "Create a new rule" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 201, description: "Created rule" })
  @ApiResponse({ status: 403, description: "Plan upgrade required" })
  async createRule(
    @Req() req: Request,
    @Param("spaceId") spaceId: string,
    @Body() body: CreateRuleDto,
  ) {
    await this.accessControl.getAccessibleSpaceOrThrow(spaceId, (req.user as any).id);
    if (body.agentId) {
      await this.accessControl.assertAgentInSpace(body.agentId, spaceId);
    }
    return this.rulesService.create({
      spaceId,
      agentId: body.agentId,
      scope: body.scope,
      content: body.content,
    });
  }

  @Patch("rules/:id")
  @UseGuards(PlanGuard)
  @RequirePlan("team", "enterprise")
  @ApiOperation({ summary: "Update a rule" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Updated rule" })
  @ApiResponse({ status: 403, description: "Plan upgrade required" })
  async updateRule(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: UpdateRuleDto,
  ) {
    await this.accessControl.getAccessibleRuleOrThrow(id, (req.user as any).id);
    return this.rulesService.update(id, body);
  }

  @Delete("rules/:id")
  @UseGuards(PlanGuard)
  @RequirePlan("team", "enterprise")
  @ApiOperation({ summary: "Delete a rule" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Rule deleted" })
  @ApiResponse({ status: 403, description: "Plan upgrade required" })
  async deleteRule(@Req() req: Request, @Param("id") id: string) {
    await this.accessControl.getAccessibleRuleOrThrow(id, (req.user as any).id);
    await this.rulesService.delete(id);
    return { success: true };
  }

  @Get("spaces/:spaceId/suggested-rules")
  @ApiOperation({ summary: "List pending rule suggestions" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Array of suggested rules" })
  async listSuggested(@Req() req: Request, @Param("spaceId") spaceId: string) {
    await this.accessControl.getAccessibleSpaceOrThrow(spaceId, (req.user as any).id);
    return this.suggestedRulesService.findPending(spaceId);
  }

  @Post("suggested-rules/:id/accept")
  @UseGuards(PlanGuard)
  @RequirePlan("team", "enterprise")
  @ApiOperation({ summary: "Accept a suggested rule" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 201, description: "Rule accepted and created" })
  @ApiResponse({ status: 403, description: "Plan upgrade required" })
  async acceptSuggestion(@Req() req: Request, @Param("id") id: string) {
    await this.accessControl.getAccessibleSuggestedRuleOrThrow(id, (req.user as any).id);
    return this.suggestedRulesService.accept(id);
  }

  @Post("suggested-rules/:id/reject")
  @ApiOperation({ summary: "Reject a suggested rule" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 201, description: "Rule rejected" })
  async rejectSuggestion(@Req() req: Request, @Param("id") id: string) {
    await this.accessControl.getAccessibleSuggestedRuleOrThrow(id, (req.user as any).id);
    return this.suggestedRulesService.reject(id);
  }
}
