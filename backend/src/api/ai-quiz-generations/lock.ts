import { redis } from "../../redis/index.js";

const LOCK_PREFIX = "ai-quiz:generation:active:";

export function generationLockKey(userId: string): string {
  return LOCK_PREFIX + userId;
}

export function generationLockTtlSeconds(): number {
  return Number(process.env.AI_QUIZ_GENERATION_LOCK_TTL_SECONDS ?? 3600);
}

export async function acquireGenerationLock(
  userId: string,
  generationId: string,
): Promise<boolean> {
  const key = generationLockKey(userId);
  const ok = await redis.set(key, generationId, {
    NX: true,
    EX: generationLockTtlSeconds(),
  });
  return ok === "OK";
}

const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`;

export async function releaseGenerationLock(
  userId: string,
  generationId: string,
): Promise<void> {
  const key = generationLockKey(userId);
  await redis.eval(RELEASE_SCRIPT, {
    keys: [key],
    arguments: [generationId],
  });
}
