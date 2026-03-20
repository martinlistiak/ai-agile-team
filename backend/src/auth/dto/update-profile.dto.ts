import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
  IsUrl,
} from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  /** Omit to leave unchanged; send `null` to clear. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== "")
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string | null;
}
