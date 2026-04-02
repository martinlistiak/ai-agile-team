import { IsString, IsNotEmpty, IsOptional, IsEnum } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateTicketDto {
  @ApiProperty({ example: "Implement user login" })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: "Add email/password login with JWT" })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    enum: ["low", "medium", "high", "critical"],
    example: "medium",
  })
  @IsEnum(["low", "medium", "high", "critical"])
  @IsOptional()
  priority?: string;

  @ApiPropertyOptional({
    enum: ["backlog", "development", "review", "testing", "staged", "done"],
    example: "backlog",
  })
  @IsEnum(["backlog", "development", "review", "testing", "staged", "done"])
  @IsOptional()
  status?: string;
}
