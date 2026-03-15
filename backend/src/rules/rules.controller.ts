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
import { AuthGuard } from "@nestjs/passport";
import { RulesService } from "./rules.service";
import { SuggestedRulesService } from "./suggested-rules.service";
import { CreateRuleDto } from "./dto/create-rule.dto";
import { UpdateRuleDto } from "./dto/update-rule.dto";

@Controller()
@UseGuards(AuthGuard("jwt"))
export class RulesController {
  constructor(
    private rulesService: RulesService,
    private suggestedRulesService: SuggestedRulesService,
  ) {}

  // --- Rules CRUD ---

  @Get("spaces/:spaceId/rules")
  async listRules(@Param("spaceId") spaceId: string) {
    return this.rulesService.findBySpace(spaceId);
  }

  @Post("spaces/:spaceId/rules")
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
  async updateRule(@Param("id") id: string, @Body() body: UpdateRuleDto) {
    return this.rulesService.update(id, body);
  }

  @Delete("rules/:id")
  async deleteRule(@Param("id") id: string) {
    await this.rulesService.delete(id);
    return { success: true };
  }

  // --- Suggested Rules ---

  @Get("spaces/:spaceId/suggested-rules")
  async listSuggested(@Param("spaceId") spaceId: string) {
    return this.suggestedRulesService.findPending(spaceId);
  }

  @Post("suggested-rules/:id/accept")
  async acceptSuggestion(@Param("id") id: string) {
    return this.suggestedRulesService.accept(id);
  }

  @Post("suggested-rules/:id/reject")
  async rejectSuggestion(@Param("id") id: string) {
    return this.suggestedRulesService.reject(id);
  }
}
