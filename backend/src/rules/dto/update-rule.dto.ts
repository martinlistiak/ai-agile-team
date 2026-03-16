import { IsString, IsOptional, IsBoolean } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateRuleDto {
  @ApiPropertyOptional({ example: "Updated rule content" })
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
