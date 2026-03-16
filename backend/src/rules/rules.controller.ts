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
import { RulesService } from "./rules.service";
import { SuggestedRulesService } from "./suggested-rules.service";
import { CreateRuleDto } from "./dto/create-rule.dto";
import { UpdateRuleDto } from "./dto/update-rule.dto";

@ApiTags("Rules")
@ApiBearerAuth("bearer")
@Controller()
@UseGuards(JwtOrApiKeyGuard)
export class RulesController {
  constructor(
    private rulesService: RulesService,
    private suggestedRulesService: SuggestedRulesService,
  ) {}

  @Get("spaces/:spaceId/rules")
  @ApiOperation({ summary: "List all rules in a space" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Array of rules" })
  async listRules(@Param("spaceId") spaceId: string) {
    return this.rulesService.findBySpace(spaceId);
  }

  @Post("spaces/:spaceId/rules")
  @ApiOperation({ summary: "Create a new rule" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 201, description: "Created rule" })
  async createRule(
    @Param("spaceId") spaceId: string,
    @Body() body: CreateRuleDto,
  ) {
    return this.rulesService.create({
      spaceId,
      agentId: body.agentId,
      scope: body.scope,
      content: body.content,
    });
  }

  @Patch("rules/:id")
  @ApiOperation({ summary: "Update a rule" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Updated rule" })
  async updateRule(@Param("id") id: string, @Body() body: UpdateRuleDto) {
    return this.rulesService.update(id, body);
  }

  @Delete("rules/:id")
  @ApiOperation({ summary: "Delete a rule" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 200, description: "Rule deleted" })
  async deleteRule(@Param("id") id: string) {
    await this.rulesService.delete(id);
    return { success: true };
  }

  @Get("spaces/:spaceId/suggested-rules")
  @ApiOperation({ summary: "List pending rule suggestions" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Array of suggested rules" })
  async listSuggested(@Param("spaceId") spaceId: string) {
    return this.suggestedRulesService.findPending(spaceId);
  }

  @Post("suggested-rules/:id/accept")
  @ApiOperation({ summary: "Accept a suggested rule" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 201, description: "Rule accepted and created" })
  async acceptSuggestion(@Param("id") id: string) {
    return this.suggestedRulesService.accept(id);
  }

  @Post("suggested-rules/:id/reject")
  @ApiOperation({ summary: "Reject a suggested rule" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 201, description: "Rule rejected" })
  async rejectSuggestion(@Param("id") id: string) {
    return this.suggestedRulesService.reject(id);
  }
}
