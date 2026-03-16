import { ApiSchema } from "@nestjs/swagger";

@ApiSchema({ description: "Empty body — ticketId comes from the URL param" })
export class TriggerAgentDto {}
