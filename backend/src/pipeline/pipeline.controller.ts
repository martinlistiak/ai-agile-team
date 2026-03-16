import {
  Body,
  Controller,
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
import { Throttle } from "@nestjs/throttler";
import { PipelineService } from "./pipeline.service";

@ApiTags("Pipeline")
@ApiBearerAuth("bearer")
@Controller()
@UseGuards(JwtOrApiKeyGuard)
export class PipelineController {
  constructor(private pipelineService: PipelineService) {}

  @Get("spaces/:spaceId/pipeline")
  @ApiOperation({ summary: "Get pipeline configuration for a space" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Pipeline config object" })
  async getConfig(@Param("spaceId") spaceId: string) {
    return this.pipelineService.getPipelineConfig(spaceId);
  }

  @Patch("spaces/:spaceId/pipeline")
  @ApiOperation({ summary: "Update pipeline stage toggles" })
  @ApiParam({ name: "spaceId", format: "uuid" })
  @ApiResponse({ status: 200, description: "Updated pipeline config" })
  async updateConfig(
    @Param("spaceId") spaceId: string,
    @Body() body: Record<string, boolean>,
  ) {
    return this.pipelineService.updatePipelineConfig(spaceId, body);
  }

  @Post("tickets/:id/advance")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: "Advance a ticket to the next pipeline stage" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 201, description: "Ticket advanced" })
  @ApiResponse({ status: 429, description: "Rate limited" })
  async advanceTicket(@Param("id") id: string) {
    return this.pipelineService.advanceTicket(id);
  }

  @Post("tickets/:id/run-pipeline")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: "Run the full pipeline on a ticket from the start" })
  @ApiParam({ name: "id", format: "uuid" })
  @ApiResponse({ status: 201, description: "Pipeline started" })
  @ApiResponse({ status: 429, description: "Rate limited" })
  async runPipeline(@Param("id") id: string) {
    return this.pipelineService.runPipeline(id);
  }
}
