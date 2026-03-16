import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateTicketDto {
  @ApiPropertyOptional({ example: "Updated title" })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: "Updated description" })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: ["low", "medium", "high", "critical"] })
  @IsEnum(["low", "medium", "high", "critical"])
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional({ format: "uuid" })
  @IsUUID()
  @IsOptional()
  assigneeAgentId?: string | null;

  @ApiPropertyOptional({ format: "uuid" })
  @IsUUID()
  @IsOptional()
  assigneeUserId?: string | null;

  @ApiPropertyOptional({
    description:
      "When true and assigneeAgentId is set, move ticket to agent default column and trigger the agent",
  })
  @IsBoolean()
  @IsOptional()
  startWorking?: boolean;
}
