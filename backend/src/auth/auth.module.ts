import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { ApiKeyStrategy } from "./api-key.strategy";
import { JwtOrApiKeyGuard } from "./jwt-or-apikey.guard";
import { User } from "../entities/user.entity";
import { IntegrationsModule } from "../integrations/integrations.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get("JWT_SECRET", "dev-secret-change-me"),
        signOptions: { expiresIn: config.get("JWT_EXPIRATION", "7d") },
      }),
    }),
    IntegrationsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ApiKeyStrategy, JwtOrApiKeyGuard],
  exports: [AuthService, JwtModule, JwtOrApiKeyGuard],
})
export class AuthModule {}
