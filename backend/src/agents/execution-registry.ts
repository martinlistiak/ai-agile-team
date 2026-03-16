import { Injectable, Logger } from "@nestjs/common";

/**
 * Tracks running agent executions so they can be aborted on demand.
 * Each execution is associated with an AbortController.
 */
@Injectable()
export class ExecutionRegistry {
  private readonly logger = new Logger(ExecutionRegistry.name);
  private readonly controllers = new Map<string, AbortController>();

  register(executionId: string): AbortController {
    const controller = new AbortController();
    this.controllers.set(executionId, controller);
    return controller;
  }

  abort(executionId: string): boolean {
    const controller = this.controllers.get(executionId);
    if (!controller) return false;
    controller.abort();
    this.controllers.delete(executionId);
    this.logger.log(`Aborted execution ${executionId}`);
    return true;
  }

  remove(executionId: string): void {
    this.controllers.delete(executionId);
  }

  isRunning(executionId: string): boolean {
    return this.controllers.has(executionId);
  }
}
