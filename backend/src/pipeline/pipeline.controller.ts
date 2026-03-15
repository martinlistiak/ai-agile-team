import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import { PipelineService } from "./pipeline.service";

@Controller()
@UseGuards(AuthGuard("jwt"))
export class PipelineController {
  constructor(private pipelineService: PipelineService) {}

  @Get("spaces/:spaceId/pipeline")
  async getConfig(@Param("spaceId") spaceId: string) {
    return this.pipelineService.getPipelineConfig(spaceId);
  }

  @Patch("spaces/:spaceId/pipeline")
  async updateConfig(
    @Param("spaceId") spaceId: string,
    @Body() body: Record<string, boolean>,
  ) {
    return this.pipelineService.updatePipelineConfig(spaceId, body);
  }

  @Post("tickets/:id/advance")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async advanceTicket(@Param("id") id: string) {
    return this.pipelineService.advanceTicket(id);
  }

  @Post("tickets/:id/run-pipeline")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async runPipeline(@Param("id") id: string) {
    return this.pipelineService.runPipeline(id);
  }
}
