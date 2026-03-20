import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { User } from "../entities/user.entity";
import { Space } from "../entities/space.entity";
import { Execution } from "../entities/execution.entity";

@Module({
  imports: [TypeOrmModule.forFeature([User, Space, Execution])],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
