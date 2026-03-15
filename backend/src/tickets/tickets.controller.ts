import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  Inject,
  Req,
  forwardRef,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import { TicketsService } from "./tickets.service";
import { PipelineService } from "../pipeline/pipeline.service";
import { TriggerAgentDto } from "./dto/trigger-agent.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { UpdateTicketDto } from "./dto/update-ticket.dto";
import { MoveTicketDto } from "./dto/move-ticket.dto";

@Controller()
@UseGuards(AuthGuard("jwt"))
export class TicketsController {
  constructor(
    private ticketsService: TicketsService,
    @Inject(forwardRef(() => PipelineService))
    private pipelineService: PipelineService,
  ) {}

  @Get("spaces/:spaceId/tickets")
  async findBySpace(@Param("spaceId") spaceId: string) {
    return this.ticketsService.findBySpace(spaceId);
  }

  @Post("spaces/:spaceId/tickets")
  async create(
    @Param("spaceId") spaceId: string,
    @Body() body: CreateTicketDto,
  ) {
    return this.ticketsService.create({ spaceId, ...body });
  }

  @Get("tickets/:id")
  async findOne(@Param("id") id: string) {
    return this.ticketsService.findById(id);
  }

  @Patch("tickets/:id")
  async update(@Param("id") id: string, @Body() body: UpdateTicketDto) {
    return this.ticketsService.update(id, body);
  }

  @Patch("tickets/:id/move")
  async move(@Param("id") id: string, @Body() body: MoveTicketDto) {
    return this.ticketsService.moveTicket(id, body.status, "user");
  }

  @Post("tickets/:id/comments")
  async addComment(
    @Param("id") id: string,
    @Body() body: CreateCommentDto,
    @Req() req: any,
  ) {
    return this.ticketsService.addComment(
      id,
      body.content,
      "user",
      req.user.id,
    );
  }

  @Delete("tickets/:id")
  @HttpCode(204)
  async remove(@Param("id") id: string) {
    await this.ticketsService.delete(id);
  }

  @Post("tickets/:id/trigger-agent")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async triggerAgent(@Param("id") id: string, @Body() _body: TriggerAgentDto) {
    return this.pipelineService.triggerAgentForTicket(id);
  }
}
