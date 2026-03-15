import { IsString, IsOptional, IsEnum } from "class-validator";

export class UpdateTicketDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(["low", "medium", "high", "critical"])
  @IsOptional()
  priority?: string;
}
