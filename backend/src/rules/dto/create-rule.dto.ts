import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class CreateRuleDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  scope: string;

  @IsString()
  @IsOptional()
  agentId?: string;
}
