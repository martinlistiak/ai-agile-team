import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";

@WebSocketGateway({
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage("join_space")
  handleJoinSpace(client: Socket, data: { space_id: string }) {
    client.join(data.space_id);
    this.logger.log(`Client ${client.id} joined space ${data.space_id}`);
  }

  @SubscribeMessage("leave_space")
  handleLeaveSpace(client: Socket, data: { space_id: string }) {
    client.leave(data.space_id);
    this.logger.log(`Client ${client.id} left space ${data.space_id}`);
  }

  // Helper methods for emitting events from other services
  emitTicketCreated(spaceId: string, ticket: any) {
    this.server?.to(spaceId).emit("ticket_created", { ticket });
  }

  emitTicketUpdated(spaceId: string, ticket: any) {
    this.server?.to(spaceId).emit("ticket_updated", { ticket });
  }

  emitAgentStatus(spaceId: string, agentId: string, status: string) {
    this.server?.to(spaceId).emit("agent_status", { agentId, status });
  }

  emitChatMessage(spaceId: string, message: any) {
    this.server?.to(spaceId).emit("chat_message", { message });
  }

  emitPipelineEvent(spaceId: string, event: any) {
    this.server?.to(spaceId).emit("pipeline_event", event);
  }

  emitSuggestedRule(spaceId: string, suggestion: any) {
    this.server?.to(spaceId).emit("suggested_rule", { suggestion });
  }

  emitExecutionAction(
    spaceId: string,
    payload: {
      executionId: string;
      agentId: string;
      tool: string;
      inputSummary: string;
      timestamp: string;
    },
  ) {
    this.server?.to(spaceId).emit("execution_action", payload);
  }

  emitPipelineCompleted(
    spaceId: string,
    payload: {
      ticketId: string;
      completedStage: string;
      nextStage: string | null;
      agentType: string;
    },
  ) {
    this.server?.to(spaceId).emit("pipeline_completed", payload);
  }

  emitFileChange(
    spaceId: string,
    payload: {
      executionId: string;
      filePath: string;
      content: string;
      diff: { additions: number[]; deletions: number[] };
    },
  ) {
    this.server?.to(spaceId).emit("file_change", payload);
  }

  emitBrowserScreenshot(
    spaceId: string,
    payload: {
      executionId: string;
      screenshot: string;
      timestamp: string;
    },
  ) {
    this.server?.to(spaceId).emit("browser_screenshot", payload);
  }

  emitBrowserSessionEnd(
    spaceId: string,
    payload: {
      executionId: string;
      timestamp: string;
    },
  ) {
    this.server?.to(spaceId).emit("browser_session_end", payload);
  }

  emitGithubPush(
    spaceId: string,
    payload: {
      spaceId: string;
      commitSha: string;
      commitMessage: string;
      author: string;
    },
  ) {
    this.server?.to(spaceId).emit("github_push", payload);
  }
}
