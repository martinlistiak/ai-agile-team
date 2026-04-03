import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCostWeightedTokens1712102400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "executions" ADD COLUMN IF NOT EXISTS "costWeightedTokens" integer NOT NULL DEFAULT 0`,
    );

    // Backfill existing rows using Sonnet input pricing as the base unit ($3/M).
    // Formula: cost_usd = (input * inputRate + output * outputRate
    //          + cacheRead * cacheReadRate + cacheCreation * cacheCreationRate) / 1e6
    // cost_weighted_tokens = cost_usd * (1e6 / 3)
    //
    // We detect the model tier from the "modelUsed" column prefix and apply
    // the correct per-token rates. Rows without a model default to Sonnet rates.
    await queryRunner.query(`
      UPDATE "executions"
      SET "costWeightedTokens" = CEIL(
        CASE
          -- Opus models: $15 input, $75 output, $1.50 cache-read, $18.75 cache-write per 1M
          WHEN LOWER("modelUsed") LIKE 'claude-opus-4%' THEN
            (("inputTokens" * 15.0 + "outputTokens" * 75.0
              + "cacheReadTokens" * 1.5 + "cacheCreationTokens" * 18.75) / 3.0)

          -- Haiku 4.x models: $1 input, $5 output, $0.10 cache-read, $1.25 cache-write per 1M
          WHEN LOWER("modelUsed") LIKE 'claude-haiku-4%' THEN
            (("inputTokens" * 1.0 + "outputTokens" * 5.0
              + "cacheReadTokens" * 0.1 + "cacheCreationTokens" * 1.25) / 3.0)

          -- Haiku 3.x models: $0.25 input, $1.25 output, $0.03 cache-read, $0.30 cache-write per 1M
          WHEN LOWER("modelUsed") LIKE 'claude-haiku-3%' THEN
            (("inputTokens" * 0.25 + "outputTokens" * 1.25
              + "cacheReadTokens" * 0.03 + "cacheCreationTokens" * 0.30) / 3.0)

          -- Sonnet (default): $3 input, $15 output, $0.30 cache-read, $3.75 cache-write per 1M
          ELSE
            (("inputTokens" * 3.0 + "outputTokens" * 15.0
              + "cacheReadTokens" * 0.3 + "cacheCreationTokens" * 3.75) / 3.0)
        END
      )
      WHERE "tokensUsed" > 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "executions" DROP COLUMN IF EXISTS "costWeightedTokens"`,
    );
  }
}
