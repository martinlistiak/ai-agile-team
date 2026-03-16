import { IsString, IsNotEmpty, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateRuleDto {
  @ApiProperty({ example: "Always write unit tests for new functions" })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ enum: ["space", "agent"], example: "space" })
  @IsString()
  @IsNotEmpty()
  scope: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Agent ID if scope is 'agent'",
  })
  @IsString()
  @IsOptional()
  agentId?: string;
}
