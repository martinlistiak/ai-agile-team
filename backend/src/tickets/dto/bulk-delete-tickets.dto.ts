import { IsArray, IsUUID, ArrayMinSize } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class BulkDeleteTicketsDto {
  @ApiProperty({
    description: "Array of ticket IDs to delete",
    example: ["uuid-1", "uuid-2"],
  })
  @IsArray()
  @IsUUID("4", { each: true })
  @ArrayMinSize(1)
  ticketIds: string[];
}
