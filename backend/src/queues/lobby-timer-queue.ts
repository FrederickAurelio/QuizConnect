import { Job, Queue, Worker } from "bullmq";
import { redis } from "../redis/index.js";

const LOBBY_TIMER_QUEUE_NAME = "lobby-timer-queue";
const PENDING_JOB_KEY = "game:flow:pending-job";
const PENDING_JOB_TTL = 3600 * 3; // same order as lobby session

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

export type LobbyTimerJobData =
  | {
      type: "next-game-flow";
      gameCode: string;
    }
  | {
      type: "close-lobby-cleanup";
      gameCode: string;
      userId: string;
      quizId: string;
    };

const queue = new Queue<LobbyTimerJobData>(LOBBY_TIMER_QUEUE_NAME, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail: 1000,
  },
});

let worker: Worker<LobbyTimerJobData> | null = null;

/** Worker must use maxRetriesPerRequest: null for blocking commands (BullMQ requirement). */
const getWorkerConnection = () => ({
  ...getRedisConnection(),
  maxRetriesPerRequest: null as null,
});

// BullMQ job IDs cannot contain ":"
// Use unique id per run so we never remove the job currently being processed.
const nextGameFlowJobId = (gameCode: string) =>
  `next-game-flow-${gameCode}-${Date.now()}`;
const closeLobbyCleanupJobId = (gameCode: string) =>
  `close-lobby-cleanup-${gameCode}`;

const removeJobIfExists = async (jobId: string) => {
  const existing = await queue.getJob(jobId);
  if (existing) {
    await existing.remove();
  }
};

export const scheduleNextGameFlowJob = async (
  gameCode: string,
  delayMs: number,
) => {
  const jobId = nextGameFlowJobId(gameCode);
  await queue.add(
    "lobby-timer",
    {
      type: "next-game-flow",
      gameCode,
    },
    {
      jobId,
      delay: delayMs,
    },
  );
  await redis.set(`${PENDING_JOB_KEY}:${gameCode}`, jobId, { EX: PENDING_JOB_TTL });
};

export const cancelNextGameFlowJob = async (gameCode: string) => {
  const jobId = await redis.get(`${PENDING_JOB_KEY}:${gameCode}`);
  if (jobId) {
    await removeJobIfExists(jobId);
    await redis.del(`${PENDING_JOB_KEY}:${gameCode}`);
  }
};

export const scheduleCloseLobbyCleanupJob = async (
  gameCode: string,
  userId: string,
  quizId: string,
  delayMs: number,
) => {
  const jobId = closeLobbyCleanupJobId(gameCode);
  await removeJobIfExists(jobId);
  await queue.add(
    "lobby-timer",
    {
      type: "close-lobby-cleanup",
      gameCode,
      userId,
      quizId,
    },
    {
      jobId,
      delay: delayMs,
    },
  );
};

export const startLobbyTimerWorker = (
  processor: (job: Job<LobbyTimerJobData>) => Promise<void>,
) => {
  if (worker) return worker;

  worker = new Worker<LobbyTimerJobData>(LOBBY_TIMER_QUEUE_NAME, processor, {
    connection: getWorkerConnection(),
    concurrency: 20,
  });

  worker.on("error", (error) => {
    console.error("Lobby timer worker error:", error);
  });

  return worker;
};
