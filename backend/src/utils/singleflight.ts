import { randomUUID } from "crypto";
import { redis } from "../redis/index.js";

type ReadyResult<T> = {
  status: "ready";
  data: T;
  coalesced: boolean;
};

type ProcessingResult = {
  status: "processing";
  retryAfterMs: number;
};

export type SingleFlightResult<T> = ReadyResult<T> | ProcessingResult;

export type RunSingleFlightParams<T> = {
  lockKey: string;
  lockTtlSeconds: number;
  waitTimeoutMs: number;
  pollIntervalMs: number;
  retryAfterMs: number;
  readCurrent: () => Promise<T | null>;
  generateAndPersist: () => Promise<T>;
};

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function releaseLock(lockKey: string, ownerToken: string) {
  const releaseScript = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;
  await redis.eval(releaseScript, {
    keys: [lockKey],
    arguments: [ownerToken],
  });
}

export async function runSingleFlight<T>({
  lockKey,
  lockTtlSeconds,
  waitTimeoutMs,
  pollIntervalMs,
  retryAfterMs,
  readCurrent,
  generateAndPersist,
}: RunSingleFlightParams<T>): Promise<SingleFlightResult<T>> {
  const ownerToken = randomUUID();
  const lockAcquired = await redis.set(lockKey, ownerToken, {
    NX: true,
    EX: lockTtlSeconds,
  });

  if (lockAcquired === "OK") {
    try {
      const generated = await generateAndPersist();
      return {
        status: "ready",
        data: generated,
        coalesced: false,
      };
    } finally {
      await releaseLock(lockKey, ownerToken);
    }
  }

  const deadline = Date.now() + waitTimeoutMs;
  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);
    const current = await readCurrent();
    if (current) {
      return {
        status: "ready",
        data: current,
        coalesced: true,
      };
    }
  }

  return {
    status: "processing",
    retryAfterMs,
  };
}
