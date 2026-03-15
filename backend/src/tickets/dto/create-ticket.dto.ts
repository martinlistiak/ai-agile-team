import { IsString, IsNotEmpty, IsOptional, IsEnum } from "class-validator";

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(["low", "medium", "high", "critical"])
  @IsOptional()
  priority?: string;

  @IsEnum([
    "backlog",
    "planning",
    "development",
    "review",
    "testing",
    "staged",
    "done",
  ])
  @IsOptional()
  status?: string;
}
