import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Combined guard: tries JWT first, falls back to API key auth.
 * Accepts either a valid JWT token or a `runa_` prefixed API key
 * in the Authorization: Bearer header.
 */
@Injectable()
export class JwtOrApiKeyGuard extends AuthGuard(["jwt", "api-key"]) {
  handleRequest(err: any, user: any, _info: any, _context: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
