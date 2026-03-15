import { IsString, IsOptional, IsBoolean } from "class-validator";

export class UpdateRuleDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
