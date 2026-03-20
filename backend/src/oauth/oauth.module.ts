import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OAuthClient } from "../entities/oauth-client.entity";
import { OAuthCode } from "../entities/oauth-code.entity";
import { OAuthToken } from "../entities/oauth-token.entity";
import { OAuthController } from "./oauth.controller";
import { OAuthService } from "./oauth.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([OAuthClient, OAuthCode, OAuthToken]),
    AuthModule,
  ],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
