import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";

/**
 * Guard that blocks POST/PUT/PATCH/DELETE requests when the user is in read-only mode
 * (e.g., during impersonation). GET requests are always allowed.
 */
@Injectable()
export class ReadOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Allow if not in read-only mode
    if (!user?.readOnly) {
      return true;
    }

    // Allow GET requests (read operations)
    const method = request.method?.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return true;
    }

    // Block write operations
    throw new ForbiddenException(
      "Read-only mode: You are viewing as another user and cannot make changes.",
    );
  }
}
