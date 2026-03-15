import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Ticket } from '../entities/ticket.entity';
import { PipelineService } from './pipeline.service';
import { EventsGateway } from '../chat/events.gateway';

@Injectable()
export class PipelineListener {
  constructor(
    private pipelineService: PipelineService,
    private eventsGateway: EventsGateway,
  ) {}

  @OnEvent('ticket.created')
  handleTicketCreated(ticket: Ticket) {
    this.eventsGateway.emitTicketCreated(ticket.spaceId, ticket);
  }

  @OnEvent('ticket.updated')
  handleTicketUpdated(ticket: Ticket) {
    this.eventsGateway.emitTicketUpdated(ticket.spaceId, ticket);
  }

  @OnEvent('ticket.moved')
  handleTicketMoved(ticket: Ticket) {
    this.eventsGateway.emitTicketUpdated(ticket.spaceId, ticket);
    // Trigger pipeline orchestration
    this.pipelineService.onTicketStatusChange(ticket);
  }

  @OnEvent('suggested_rule.created')
  handleSuggestedRuleCreated(payload: { spaceId: string; suggestion: any }) {
    this.eventsGateway.emitSuggestedRule(payload.spaceId, payload.suggestion);
  }
}
