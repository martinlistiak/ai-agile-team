import { IsString, IsOptional, IsObject } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateSpaceDto {
  @ApiPropertyOptional({ example: "Renamed Project" })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: "https://github.com/user/repo" })
  @IsString()
  @IsOptional()
  githubRepoUrl?: string;

  @ApiPropertyOptional({ example: "https://gitlab.com/user/repo" })
  @IsString()
  @IsOptional()
  gitlabRepoUrl?: string;

  @ApiPropertyOptional({
    example: { planning: true, development: true, testing: false },
  })
  @IsObject()
  @IsOptional()
  pipelineConfig?: Record<string, boolean>;

  @ApiPropertyOptional({ example: "#6366f1" })
  @IsString()
  @IsOptional()
  color?: string;
}
