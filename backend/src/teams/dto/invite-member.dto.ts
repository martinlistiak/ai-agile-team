import { IsEmail, IsOptional, IsIn } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class InviteMemberDto {
  @ApiProperty({ example: "dev@example.com" })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: ["admin", "member"], default: "member" })
  @IsOptional()
  @IsIn(["admin", "member"])
  role?: "admin" | "member" = "member";
}
