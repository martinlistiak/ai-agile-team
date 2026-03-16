import { IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ["admin", "member"], example: "admin" })
  @IsIn(["admin", "member"])
  role: "admin" | "member";
}
