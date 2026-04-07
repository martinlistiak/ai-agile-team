import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { generateText } from "ai";
import { createMimoProvider } from "../agents/mimo-provider";
import {
  AgentTraining,
  TrainingStatus,
} from "../entities/agent-training.entity";
import { Agent } from "../entities/agent.entity";

@Injectable()
export class AgentTrainingService {
  private readonly logger = new Logger(AgentTrainingService.name);

  constructor(
    @InjectRepository(AgentTraining)
    private trainingRepo: Repository<AgentTraining>,
    @InjectRepository(Agent) private agentRepo: Repository<Agent>,
    private configService: ConfigService,
  ) {}

  async createTraining(
    agentId: string,
    data: {
      name: string;
      description?: string;
      documents: { fileName: string; content: string; mimeType: string }[];
    },
  ): Promise<AgentTraining> {
    const agent = await this.agentRepo.findOneBy({ id: agentId });
    if (!agent) throw new NotFoundException("Agent not found");

    if (!data.documents?.length) {
      throw new BadRequestException("At least one training document required");
    }

    const training = this.trainingRepo.create({
      agentId,
      name: data.name,
      description: data.description,
      documents: data.documents,
      documentCount: data.documents.length,
      status: "pending",
    });
    await this.trainingRepo.save(training);

    // Process asynchronously
    this.processTraining(training.id).catch((err) =>
      this.logger.error(`Training ${training.id} failed: ${err.message}`),
    );

    return training;
  }

  async getTrainings(agentId: string): Promise<AgentTraining[]> {
    return this.trainingRepo.find({
      where: { agentId },
      order: { createdAt: "DESC" },
    });
  }

  async getTraining(id: string): Promise<AgentTraining> {
    const training = await this.trainingRepo.findOneBy({ id });
    if (!training) throw new NotFoundException("Training not found");
    return training;
  }

  async deleteTraining(id: string): Promise<boolean> {
    const training = await this.trainingRepo.findOneBy({ id });
    if (!training) throw new NotFoundException("Training not found");

    // If this training was applied, remove compiled context from agent
    if (training.status === "completed" && training.compiledContext) {
      const agent = await this.agentRepo.findOneBy({ id: training.agentId });
      if (agent?.systemPrompt?.includes(training.compiledContext)) {
        agent.systemPrompt = agent.systemPrompt.replace(
          `\n\n--- Training: ${training.name} ---\n${training.compiledContext}\n--- End Training ---`,
          "",
        );
        await this.agentRepo.save(agent);
      }
    }

    const result = await this.trainingRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async applyTraining(trainingId: string): Promise<Agent> {
    const training = await this.trainingRepo.findOneBy({ id: trainingId });
    if (!training) throw new NotFoundException("Training not found");
    if (training.status !== "completed") {
      throw new BadRequestException("Training is not yet completed");
    }

    const agent = await this.agentRepo.findOneBy({ id: training.agentId });
    if (!agent) throw new NotFoundException("Agent not found");

    const trainingBlock = `\n\n--- Training: ${training.name} ---\n${training.compiledContext}\n--- End Training ---`;
    agent.systemPrompt = (agent.systemPrompt || "") + trainingBlock;
    return this.agentRepo.save(agent);
  }

  private async processTraining(trainingId: string): Promise<void> {
    const training = await this.trainingRepo.findOneBy({ id: trainingId });
    if (!training) return;

    await this.trainingRepo.update(trainingId, { status: "processing" });

    try {
      // Compile all documents into a structured context using Claude
      const documentSummaries = training.documents
        .map(
          (doc, i) =>
            `Document ${i + 1} (${doc.fileName}):\n${doc.content.slice(0, 10000)}`,
        )
        .join("\n\n---\n\n");

      const provider = createMimoProvider(
        this.configService.get("MIMO_API_KEY", ""),
      );

      const response = await generateText({
        model: provider.chatModel("mimo-v2-pro"),
        messages: [
          {
            role: "user",
            content: `You are compiling training context for an AI agent. Analyze these documents and create a concise, structured knowledge base that the agent can reference. Focus on key facts, procedures, terminology, and domain-specific knowledge.\n\nDocuments:\n${documentSummaries}\n\nCreate a structured knowledge summary:`,
          },
        ],
        maxTokens: 4096,
      });

      const compiledContext = response.text || "";

      await this.trainingRepo.update(trainingId, {
        status: "completed",
        compiledContext,
      });

      this.logger.log(`Training ${trainingId} completed successfully`);
    } catch (error) {
      await this.trainingRepo.update(trainingId, {
        status: "failed",
        errorMessage: error.message,
      });
      throw error;
    }
  }
}
