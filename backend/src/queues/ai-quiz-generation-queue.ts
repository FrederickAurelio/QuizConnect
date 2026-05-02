import { Job, Queue, Worker } from "bullmq";
import { runAiQuizGenerationJob } from "../api/ai-quiz-generations/orchestrator.js";

const QUEUE_NAME = "ai-quiz-generation-queue";

type RedisConnectionOptions = {
  host: string;
  port: number;
  username?: string | undefined;
  password?: string | undefined;
  db?: number | undefined;
  tls?: Record<string, never>;
};

const getRedisConnection = (): RedisConnectionOptions => {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(redisUrl);
  const isTls = parsed.protocol === "rediss:";
  const dbPath = parsed.pathname?.replace("/", "");

  return {
    host: parsed.hostname,
    port: Number(parsed.port || (isTls ? 6380 : 6379)),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: dbPath ? Number(dbPath) : undefined,
    ...(isTls ? { tls: {} } : {}),
  };
};

/** Worker must use maxRetriesPerRequest: null for blocking commands (BullMQ requirement). */
const getWorkerConnection = () => ({
  ...getRedisConnection(),
  maxRetriesPerRequest: null as null,
});

export type AiQuizGenerationJobData = {
  generationId: string;
};

const queue = new Queue<AiQuizGenerationJobData>(QUEUE_NAME, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 1000,
  },
});

let worker: Worker<AiQuizGenerationJobData> | null = null;

export async function enqueueAiQuizGeneration(
  generationId: string,
): Promise<void> {
  await queue.add(
    "generate-quiz",
    { generationId },
    {
      jobId: `ai-quiz-generation-${generationId}`,
    },
  );
}

export function startAiQuizGenerationWorker(): Worker<
  AiQuizGenerationJobData
> | null {
  if (worker) return worker;

  worker = new Worker<AiQuizGenerationJobData>(
    QUEUE_NAME,
    async (job: Job<AiQuizGenerationJobData>) => {
      await runAiQuizGenerationJob(job.data.generationId);
    },
    {
      connection: getWorkerConnection(),
      concurrency: 3,
    },
  );

  worker.on("error", (error) => {
    console.error("AI quiz generation worker error:", error);
  });

  return worker;
}
