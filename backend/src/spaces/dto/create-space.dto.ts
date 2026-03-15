import { IsString, IsNotEmpty, IsOptional } from "class-validator";

export class CreateSpaceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  githubRepoUrl?: string;

  @IsString()
  @IsOptional()
  gitlabRepoUrl?: string;
}
