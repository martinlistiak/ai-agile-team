import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from "class-validator";

export class DeleteAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  password?: string;

  /** Required for accounts without a password (e.g. GitHub/GitLab/SSO). Must match your email. */
  @IsOptional()
  @ValidateIf((o) => !o.password)
  @IsEmail()
  confirmationEmail?: string;
}
