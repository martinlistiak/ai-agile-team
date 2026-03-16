import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TeamsController } from "./teams.controller";
import { InvitationsController } from "./invitations.controller";
import { TeamsService } from "./teams.service";
import { MailService } from "./mail.service";
import { Team } from "../entities/team.entity";
import { TeamMember } from "../entities/team-member.entity";
import { TeamInvitation } from "../entities/team-invitation.entity";
import { User } from "../entities/user.entity";
import { BillingModule } from "../billing/billing.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Team, TeamMember, TeamInvitation, User]),
    BillingModule,
  ],
  controllers: [TeamsController, InvitationsController],
  providers: [TeamsService, MailService],
  exports: [TeamsService],
})
export class TeamsModule {}
