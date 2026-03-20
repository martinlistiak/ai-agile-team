import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Guard for the OAuth authorize endpoint.
 * Accepts JWT from either the Authorization header or the `authorization` query param.
 * This allows the browser login page to redirect with the token in the URL.
 */
@Injectable()
export class OAuthAuthorizeGuard extends AuthGuard(["jwt", "api-key"]) {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    // If no Authorization header but query param exists, inject it
    if (!req.headers.authorization && req.query?.authorization) {
      req.headers.authorization = `Bearer ${req.query.authorization}`;
    }
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, _info: any, _context: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
