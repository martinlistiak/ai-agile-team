import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Repository } from "typeorm";
import { randomUUID } from "crypto";
import { Ticket } from "../entities/ticket.entity";
import { Execution } from "../entities/execution.entity";

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

  async update(id: string, data: TicketUpdateData): Promise<Ticket> {
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
    trigger: "user" | "agent" | "pipeline" = "user",
  ): Promise<Ticket> {
    const ticket = await this.findById(id);
    const previousStatus = ticket.status;

    if (previousStatus !== status) {
      const entry = {
        from: previousStatus,
        to: status,
        timestamp: new Date().toISOString(),
        trigger,
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
  ): Promise<Ticket> {
    const ticket = await this.findById(ticketId);
    const comment = {
      id: randomUUID(),
      authorType,
      authorId,
      content,
      createdAt: new Date().toISOString(),
    };
    ticket.comments = [...(ticket.comments || []), comment];
    const saved = await this.ticketRepo.save(ticket);
    this.eventEmitter.emit("ticket.commented", saved);
    return saved;
  }
}
