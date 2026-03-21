import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1700000000000 implements MigrationInterface {
  name = "Init1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // users
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" varchar NOT NULL,
        "name" varchar NOT NULL,
        "hashedPassword" varchar,
        "githubId" bigint,
        "githubTokenEncrypted" text,
        "gitlabId" bigint,
        "gitlabTokenEncrypted" text,
        "avatarUrl" text,
        "stripeCustomerId" text,
        "stripeSubscriptionId" text,
        "planTier" text NOT NULL DEFAULT 'starter',
        "subscriptionStatus" text NOT NULL DEFAULT 'none',
        "currentPeriodEnd" timestamptz,
        "creditsBalance" int NOT NULL DEFAULT 0,
        "ssoProvider" text,
        "ssoExternalId" text,
        "emailVerifiedAt" timestamptz,
        "termsAcceptedAt" timestamptz,
        "privacyAcceptedAt" timestamptz,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_githubId" UNIQUE ("githubId"),
        CONSTRAINT "UQ_users_gitlabId" UNIQUE ("gitlabId"),
        CONSTRAINT "UQ_users_stripeCustomerId" UNIQUE ("stripeCustomerId")
      )
    `);

    // teams
    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar NOT NULL,
        "ownerId" uuid NOT NULL,
        "seatCount" int NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teams" PRIMARY KEY ("id"),
        CONSTRAINT "FK_teams_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id")
      )
    `);

    // team_members
    await queryRunner.query(`
      CREATE TABLE "team_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
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

    // team_invitations
    await queryRunner.query(`
      CREATE TABLE "team_invitations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "teamId" uuid NOT NULL,
        "email" varchar NOT NULL,
        "invitedById" uuid NOT NULL,
        "role" text NOT NULL DEFAULT 'member',
        "token" text NOT NULL,
        "status" text NOT NULL DEFAULT 'pending',
        "expiresAt" timestamptz NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_team_invitations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_team_invitations_token" UNIQUE ("token"),
        CONSTRAINT "FK_team_invitations_team" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_team_invitations_invitedBy" FOREIGN KEY ("invitedById") REFERENCES "users"("id")
      )
    `);

    // spaces
    await queryRunner.query(`
      CREATE TABLE "spaces" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "name" varchar NOT NULL,
        "githubRepoUrl" varchar,
        "gitlabRepoUrl" text,
        "githubTokenRef" text,
        "pipelineConfig" jsonb NOT NULL DEFAULT '{"planning":true,"development":true,"review":true,"testing":true,"staged":true}',
        "crossTeamRules" text,
        "order" int NOT NULL DEFAULT 0,
        "color" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_spaces" PRIMARY KEY ("id"),
        CONSTRAINT "FK_spaces_user" FOREIGN KEY ("userId") REFERENCES "users"("id")
      )
    `);

    // agents
    await queryRunner.query(`
      CREATE TABLE "agents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "spaceId" uuid NOT NULL,
        "agentType" varchar NOT NULL DEFAULT 'pm',
        "name" varchar,
        "description" text,
        "systemPrompt" text,
        "isCustom" boolean NOT NULL DEFAULT false,
        "rules" text,
        "avatarRef" varchar NOT NULL DEFAULT 'pm_default.png',
        "status" varchar NOT NULL DEFAULT 'idle',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agents_space" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id")
      )
    `);

    // tickets
    await queryRunner.query(`
      CREATE TABLE "tickets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "spaceId" uuid NOT NULL,
        "title" varchar NOT NULL,
        "description" text NOT NULL DEFAULT '',
        "status" varchar NOT NULL DEFAULT 'backlog',
        "priority" varchar NOT NULL DEFAULT 'medium',
        "assigneeAgentId" uuid,
        "assigneeUserId" uuid,
        "comments" jsonb NOT NULL DEFAULT '[]',
        "statusHistory" jsonb NOT NULL DEFAULT '[]',
        "prUrl" text,
        "order" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tickets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tickets_space" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id"),
        CONSTRAINT "FK_tickets_assigneeAgent" FOREIGN KEY ("assigneeAgentId") REFERENCES "agents"("id"),
        CONSTRAINT "FK_tickets_assigneeUser" FOREIGN KEY ("assigneeUserId") REFERENCES "users"("id")
      )
    `);

    // executions
    await queryRunner.query(`
      CREATE TABLE "executions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "agentId" uuid NOT NULL,
        "ticketId" uuid,
        "startTime" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endTime" TIMESTAMP,
        "status" varchar NOT NULL DEFAULT 'running',
        "actionLog" jsonb NOT NULL DEFAULT '[]',
        "tokensUsed" int NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_executions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_executions_agent" FOREIGN KEY ("agentId") REFERENCES "agents"("id"),
        CONSTRAINT "FK_executions_ticket" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id")
      )
    `);

    // chat_messages
    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "spaceId" uuid NOT NULL,
        "role" text NOT NULL,
        "content" text NOT NULL DEFAULT '',
        "agentType" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_messages" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_messages_space" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE
      )
    `);

    // chat_attachments
    await queryRunner.query(`
      CREATE TABLE "chat_attachments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "messageId" uuid NOT NULL,
        "fileName" text NOT NULL,
        "mimeType" text NOT NULL,
        "byteSize" int NOT NULL,
        "data" bytea NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_chat_attachments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_chat_attachments_message" FOREIGN KEY ("messageId") REFERENCES "chat_messages"("id") ON DELETE CASCADE
      )
    `);

    // rules
    await queryRunner.query(`
      CREATE TABLE "rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "spaceId" uuid NOT NULL,
        "agentId" uuid,
        "scope" varchar NOT NULL DEFAULT 'space',
        "content" text NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "version" int NOT NULL DEFAULT 1,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rules_space" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_rules_agent" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL
      )
    `);

    // suggested_rules
    await queryRunner.query(`
      CREATE TABLE "suggested_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "spaceId" uuid NOT NULL,
        "agentId" uuid,
        "executionId" uuid,
        "content" text NOT NULL,
        "reasoning" text NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "suggestedScope" varchar NOT NULL DEFAULT 'agent',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_suggested_rules" PRIMARY KEY ("id"),
        CONSTRAINT "FK_suggested_rules_space" FOREIGN KEY ("spaceId") REFERENCES "spaces"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_suggested_rules_agent" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_suggested_rules_execution" FOREIGN KEY ("executionId") REFERENCES "executions"("id") ON DELETE SET NULL
      )
    `);

    // api_keys
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "name" varchar NOT NULL,
        "prefix" varchar NOT NULL,
        "hashedKey" varchar NOT NULL,
        "lastUsedAt" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_api_keys" PRIMARY KEY ("id"),
        CONSTRAINT "FK_api_keys_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // password_reset_tokens
    await queryRunner.query(`
      CREATE TABLE "password_reset_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "tokenHash" varchar(64) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_password_reset_tokens_tokenHash" UNIQUE ("tokenHash"),
        CONSTRAINT "FK_password_reset_tokens_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // email_verification_tokens
    await queryRunner.query(`
      CREATE TABLE "email_verification_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "tokenHash" varchar(64) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_email_verification_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_email_verification_tokens_tokenHash" UNIQUE ("tokenHash"),
        CONSTRAINT "FK_email_verification_tokens_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // oauth_clients
    await queryRunner.query(`
      CREATE TABLE "oauth_clients" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clientId" varchar NOT NULL,
        "clientSecret" text,
        "clientName" text,
        "redirectUris" text NOT NULL DEFAULT '',
        "grantTypes" text NOT NULL DEFAULT 'authorization_code,refresh_token',
        "responseTypes" text NOT NULL DEFAULT 'code',
        "tokenEndpointAuthMethod" text NOT NULL DEFAULT 'none',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_oauth_clients" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_oauth_clients_clientId" UNIQUE ("clientId")
      )
    `);

    // oauth_codes
    await queryRunner.query(`
      CREATE TABLE "oauth_codes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" varchar NOT NULL,
        "clientId" varchar NOT NULL,
        "userId" uuid NOT NULL,
        "redirectUri" text NOT NULL,
        "codeChallenge" text,
        "codeChallengeMethod" text,
        "scope" text NOT NULL DEFAULT 'openid',
        "expiresAt" timestamptz NOT NULL,
        "used" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_oauth_codes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_oauth_codes_code" UNIQUE ("code")
      )
    `);

    // oauth_tokens
    await queryRunner.query(`
      CREATE TABLE "oauth_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "accessToken" varchar NOT NULL,
        "refreshToken" text,
        "clientId" varchar NOT NULL,
        "userId" uuid NOT NULL,
        "scope" text NOT NULL DEFAULT 'openid',
        "expiresAt" timestamptz NOT NULL,
        "refreshExpiresAt" timestamptz,
        "revoked" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_oauth_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_oauth_tokens_accessToken" UNIQUE ("accessToken"),
        CONSTRAINT "UQ_oauth_tokens_refreshToken" UNIQUE ("refreshToken")
      )
    `);

    // sso_configs
    await queryRunner.query(`
      CREATE TABLE "sso_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "teamId" uuid NOT NULL,
        "provider" text NOT NULL DEFAULT 'saml',
        "entityId" text NOT NULL,
        "ssoUrl" text NOT NULL,
        "certificate" text NOT NULL,
        "metadataUrl" text,
        "defaultRole" text,
        "enforceSSO" boolean NOT NULL DEFAULT false,
        "enabled" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sso_configs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sso_configs_team" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE
      )
    `);

    // sla_configs
    await queryRunner.query(`
      CREATE TABLE "sla_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "teamId" uuid NOT NULL,
        "uptimeTarget" decimal(5,2) NOT NULL DEFAULT 99.9,
        "responseTimeMsTarget" int NOT NULL DEFAULT 500,
        "resolutionTimeHoursTarget" int NOT NULL DEFAULT 4,
        "currentUptime" decimal(5,2) NOT NULL DEFAULT 100,
        "avgResponseTimeMs" int NOT NULL DEFAULT 0,
        "totalIncidents" int NOT NULL DEFAULT 0,
        "resolvedIncidents" int NOT NULL DEFAULT 0,
        "lastCheckedAt" timestamptz,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sla_configs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sla_configs_team" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE
      )
    `);

    // agent_trainings
    await queryRunner.query(`
      CREATE TABLE "agent_trainings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "agentId" uuid NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "status" text NOT NULL DEFAULT 'pending',
        "documents" jsonb NOT NULL DEFAULT '[]',
        "compiledContext" text,
        "documentCount" int NOT NULL DEFAULT 0,
        "errorMessage" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_agent_trainings" PRIMARY KEY ("id"),
        CONSTRAINT "FK_agent_trainings_agent" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE
      )
    `);

    // analytics_events
    await queryRunner.query(`
      CREATE TABLE "analytics_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "teamId" varchar NOT NULL,
        "userId" varchar,
        "spaceId" varchar,
        "eventType" text NOT NULL,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_analytics_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_team_created" ON "analytics_events" ("teamId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_analytics_events_type_created" ON "analytics_events" ("eventType", "createdAt")`,
    );

    // notifications
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" text NOT NULL,
        "title" varchar NOT NULL,
        "message" text NOT NULL,
        "relatedEntityId" text,
        "relatedEntityType" text,
        "spaceId" text,
        "read" boolean NOT NULL DEFAULT false,
        "emailSent" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_read" ON "notifications" ("userId", "read")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_created" ON "notifications" ("userId", "createdAt")`,
    );

    // notification_preferences
    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "inAppAgentCompleted" boolean NOT NULL DEFAULT true,
        "inAppAgentFailed" boolean NOT NULL DEFAULT true,
        "inAppPipelineStageChanged" boolean NOT NULL DEFAULT true,
        "inAppPrCreated" boolean NOT NULL DEFAULT true,
        "inAppTicketAssigned" boolean NOT NULL DEFAULT true,
        "inAppTicketCommented" boolean NOT NULL DEFAULT true,
        "inAppTeamInvitation" boolean NOT NULL DEFAULT true,
        "inAppTeamMemberJoined" boolean NOT NULL DEFAULT true,
        "emailAgentCompleted" boolean NOT NULL DEFAULT true,
        "emailAgentFailed" boolean NOT NULL DEFAULT true,
        "emailPipelineStageChanged" boolean NOT NULL DEFAULT true,
        "emailPrCreated" boolean NOT NULL DEFAULT true,
        "emailTicketAssigned" boolean NOT NULL DEFAULT false,
        "emailTicketCommented" boolean NOT NULL DEFAULT false,
        "emailTeamInvitation" boolean NOT NULL DEFAULT true,
        "emailTeamMemberJoined" boolean NOT NULL DEFAULT false,
        "emailDigestFrequency" text NOT NULL DEFAULT 'instant',
        "muteAll" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_preferences_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_notification_preferences_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "notification_preferences" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "analytics_events" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agent_trainings" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sla_configs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sso_configs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "oauth_tokens" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "oauth_codes" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "oauth_clients" CASCADE`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "email_verification_tokens" CASCADE`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "password_reset_tokens" CASCADE`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "suggested_rules" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rules" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_attachments" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "executions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tickets" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "agents" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "spaces" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_invitations" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "team_members" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "teams" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);
  }
}
