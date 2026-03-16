import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IntegrationsController } from "./integrations.controller";
import { IntegrationsService } from "./integrations.service";
import { User } from "../entities/user.entity";
import { ApiKey } from "../entities/api-key.entity";
import { CommonModule } from "../common/common.module";

@Module({
  imports: [TypeOrmModule.forFeature([User, ApiKey]), CommonModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
