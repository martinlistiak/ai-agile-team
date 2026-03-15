import { IsString, IsEnum, IsOptional } from "class-validator";

export class SendChatMessageDto {
  @IsString()
  message: string;

  @IsEnum(["pm", "developer", "tester"])
  agentType: string;

  @IsString()
  @IsOptional()
  ticketId?: string;
}
