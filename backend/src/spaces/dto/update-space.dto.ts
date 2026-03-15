import { IsString, IsOptional, IsObject } from "class-validator";

export class UpdateSpaceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  githubRepoUrl?: string;

  @IsString()
  @IsOptional()
  gitlabRepoUrl?: string;

  @IsObject()
  @IsOptional()
  pipelineConfig?: Record<string, boolean>;

  @IsString()
  @IsOptional()
  color?: string;
}
