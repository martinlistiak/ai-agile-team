import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTeams1700000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "name" varchar NOT NULL,
        "ownerId" uuid NOT NULL,
        "seatCount" int NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teams" PRIMARY KEY ("id"),
        CONSTRAINT "FK_teams_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "team_members" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "teamId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" text NOT NULL DEFAULT 'member',
        "joinedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_team_members" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_team_members_team_user" UNIQUE ("teamId", "userId"),
        CONSTRAINT "FK_team_members_team" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "team_invitations" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "teamId" uuid NOT NULL,
        "email" varchar NOT NULL,
        "invitedById" uuid NOT NULL,
        "role" text NOT NULL DEFAULT 'member',
        "token" text NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_team_invitations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_team_invitations_token" UNIQUE ("token"),
        CONSTRAINT "FK_team_invitations_team" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_invitations_inviter" FOREIGN KEY ("invitedById") REFERENCES "users"("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "team_invitations"`);
    await queryRunner.query(`DROP TABLE "team_members"`);
    await queryRunner.query(`DROP TABLE "teams"`);
  }
}
