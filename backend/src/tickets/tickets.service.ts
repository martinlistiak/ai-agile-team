import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Repository } from "typeorm";
import { randomUUID } from "crypto";
import { Ticket } from "../entities/ticket.entity";
import { Execution } from "../entities/execution.entity";
import { Space } from "../entities/space.entity";

/** Update payload that allows null for assignee fields (to clear assignment). */
export type TicketUpdateData = Omit<
  Partial<Ticket>,
  "assigneeAgentId" | "assigneeUserId"
> & {
  assigneeAgentId?: string | null;
  assigneeUserId?: string | null;
};

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket) private ticketRepo: Repository<Ticket>,
    @InjectRepository(Execution) private executionRepo: Repository<Execution>,
    @InjectRepository(Space) private spaceRepo: Repository<Space>,
    private eventEmitter: EventEmitter2,
  ) {}

  async findBySpace(spaceId: string): Promise<Ticket[]> {
    return this.ticketRepo.find({
      where: { spaceId },
      order: { status: "ASC", order: "ASC", createdAt: "DESC" },
    });
  }

  async findById(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOneBy({ id });
    if (!ticket) throw new NotFoundException("Ticket not found");
    return ticket;
  }

  async getSpaceForTicket(ticketId: string): Promise<Space> {
    const ticket = await this.findById(ticketId);
    const space = await this.spaceRepo.findOneBy({ id: ticket.spaceId });
    if (!space) throw new NotFoundException("Space not found");
    return space;
  }

  async create(data: {
    spaceId: string;
    title: string;
    description?: string;
    priority?: string;
    status?: string;
  }): Promise<Ticket> {
    const status = data.status || "backlog";

    // Get the max order for this space+status to append at the end
    const result = await this.ticketRepo
      .createQueryBuilder("t")
      .select("COALESCE(MAX(t.order), -1)", "maxOrder")
      .where("t.spaceId = :spaceId AND t.status = :status", {
        spaceId: data.spaceId,
        status,
      })
      .getRawOne();
    const nextOrder = (result?.maxOrder ?? -1) + 1;

    const ticket = this.ticketRepo.create({
      spaceId: data.spaceId,
      title: data.title,
      description: data.description || "",
      priority: data.priority || "medium",
      status,
      order: nextOrder,
    });
    const saved = await this.ticketRepo.save(ticket);
    this.eventEmitter.emit("ticket.created", saved);
    return saved;
  }

  async update(
    id: string,
    data: TicketUpdateData,
    actor?: { id: string; name: string; type: "user" | "agent" },
  ): Promise<Ticket> {
    const ticket = await this.findById(id);

    // Assigning to agent clears user assignee and vice versa
    // Use else-if to avoid the second branch undoing the first when it sets null
    if (data.assigneeAgentId !== undefined) {
      (data as Record<string, unknown>).assigneeUserId = null;
    } else if (data.assigneeUserId !== undefined) {
      (data as Record<string, unknown>).assigneeAgentId = null;
    }

    // Record status transition if status is changing
    if (data.status && data.status !== ticket.status) {
      const entry = {
        from: ticket.status,
        to: data.status,
        timestamp: new Date().toISOString(),
        trigger: "user" as const,
        actorId: actor?.id,
        actorName: actor?.name,
        actorType: actor?.type,
      };
      data.statusHistory = [...(ticket.statusHistory || []), entry];
    }

    await this.ticketRepo.update(id, data as Partial<Ticket>);
    const updated = await this.findById(id);
    this.eventEmitter.emit("ticket.updated", updated);
    return updated;
  }

  async moveTicket(
    id: string,
    status: string,
    trigger: "user" | "agent" | "pipeline" | "mention" = "user",
    actor?: { id: string; name: string; type: "user" | "agent" },
  ): Promise<Ticket> {
    const ticket = await this.findById(id);
    const previousStatus = ticket.status;

    if (previousStatus !== status) {
      const entry = {
        from: previousStatus,
        to: status,
        timestamp: new Date().toISOString(),
        trigger,
        actorId: actor?.id,
        actorName: actor?.name,
        actorType: actor?.type,
      };
      ticket.statusHistory = [...(ticket.statusHistory || []), entry];
    }

    ticket.status = status;
    const saved = await this.ticketRepo.save(ticket);
    this.eventEmitter.emit("ticket.moved", saved);
    return saved;
  }

  async delete(id: string): Promise<void> {
    const ticket = await this.findById(id);
    // Nullify execution references to avoid FK constraint violation
    await this.executionRepo
      .createQueryBuilder()
      .update(Execution)
      .set({ ticketId: () => "NULL" })
      .where('"ticketId" = :id', { id })
      .execute();
    await this.ticketRepo.remove(ticket);
    this.eventEmitter.emit("ticket.deleted", ticket);
  }

  async bulkDelete(ids: string[]): Promise<number> {
    if (!ids.length) return 0;

    // Nullify execution references for all tickets
    await this.executionRepo
      .createQueryBuilder()
      .update(Execution)
      .set({ ticketId: () => "NULL" })
      .where('"ticketId" IN (:...ids)', { ids })
      .execute();

    const tickets = await this.ticketRepo.findByIds(ids);
    if (!tickets.length) return 0;

    await this.ticketRepo.remove(tickets);
    for (const ticket of tickets) {
      this.eventEmitter.emit("ticket.deleted", ticket);
    }
    return tickets.length;
  }

  /**
   * Reorder tickets within a column. Receives an ordered array of ticket IDs
   * representing the new order for that status column.
   */
  async reorderTickets(
    spaceId: string,
    status: string,
    ticketIds: string[],
  ): Promise<void> {
    // Batch update order for each ticket
    const promises = ticketIds.map((id, index) =>
      this.ticketRepo.update({ id, spaceId, status }, { order: index }),
    );
    await Promise.all(promises);
  }

  async addComment(
    ticketId: string,
    content: string,
    authorType: string,
    authorId: string,
    commenterName?: string,
    authorAgentType?: string,
  ): Promise<Ticket> {
    const ticket = await this.findById(ticketId);
    const comment: Record<string, unknown> = {
      id: randomUUID(),
      authorType,
      authorId,
      content,
      createdAt: new Date().toISOString(),
    };
    if (authorAgentType) {
      comment.authorAgentType = authorAgentType;
    }
    ticket.comments = [...(ticket.comments || []), comment];
    const saved = await this.ticketRepo.save(ticket);

    this.eventEmitter.emit("ticket.commented", {
      spaceId: ticket.spaceId,
      ticketId: ticket.id,
      ticketTitle: ticket.title,
      commenterId: authorId,
      commenterName:
        commenterName || (authorType === "agent" ? authorId : "User"),
    });

    // Parse mentions and emit events for agent triggers
    const mentions = this.parseMentions(content);
    if (mentions.length > 0) {
      this.eventEmitter.emit("ticket.comment.mentions", {
        spaceId: ticket.spaceId,
        ticketId: ticket.id,
        ticketTitle: ticket.title,
        content,
        mentions,
        commenterId: authorId,
        commenterName:
          commenterName || (authorType === "agent" ? authorId : "User"),
      });
    }

    return saved;
  }

  /**
   * Parse @mentions from comment content.
   * Supports: @developer, @pm, @tester, @reviewer, @dev
   */
  private parseMentions(content: string): string[] {
    const mentionPattern = /@(developer|dev|pm|tester|reviewer)\b/gi;
    const matches = content.match(mentionPattern) || [];
    const normalized = matches.map((m) => {
      const name = m.slice(1).toLowerCase();
      // Normalize @dev to @developer
      return name === "dev" ? "developer" : name;
    });
    // Return unique mentions
    return [...new Set(normalized)];
  }
}
