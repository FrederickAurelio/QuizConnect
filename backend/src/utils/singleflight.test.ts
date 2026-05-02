import test from "node:test";
import assert from "node:assert/strict";
import { runSingleFlight } from "./singleflight.js";
import { redis } from "../redis/index.js";

type RedisLike = {
  set: (
    key: string,
    value: string,
    options: { NX: true; EX: number },
  ) => Promise<"OK" | null>;
  eval: (script: string, args: { keys: string[]; arguments: string[] }) => Promise<number>;
};

const redisMock = redis as unknown as RedisLike;

test("runSingleFlight owner executes generate once", async () => {
  let releaseCalls = 0;
  redisMock.set = async () => "OK";
  redisMock.eval = async () => {
    releaseCalls += 1;
    return 1;
  };

  let generateCalls = 0;
  const result = await runSingleFlight({
    lockKey: "test:singleflight:owner",
    lockTtlSeconds: 20,
    waitTimeoutMs: 10,
    pollIntervalMs: 5,
    retryAfterMs: 100,
    readCurrent: async () => null,
    generateAndPersist: async () => {
      generateCalls += 1;
      return { ok: true };
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(result.coalesced, false);
  assert.equal(generateCalls, 1);
  assert.equal(releaseCalls, 1);
});

test("runSingleFlight follower reads coalesced data", async () => {
  redisMock.set = async () => null;
  redisMock.eval = async () => 0;

  let reads = 0;
  const result = await runSingleFlight({
    lockKey: "test:singleflight:follower",
    lockTtlSeconds: 20,
    waitTimeoutMs: 60,
    pollIntervalMs: 10,
    retryAfterMs: 100,
    readCurrent: async () => {
      reads += 1;
      if (reads < 2) return null;
      return { ok: "from-owner" };
    },
    generateAndPersist: async () => ({ ok: "should-not-run" }),
  });

  assert.equal(result.status, "ready");
  assert.equal(result.coalesced, true);
  assert.deepEqual(result.data, { ok: "from-owner" });
});

test("runSingleFlight follower returns processing after timeout", async () => {
  redisMock.set = async () => null;
  redisMock.eval = async () => 0;

  const result = await runSingleFlight({
    lockKey: "test:singleflight:timeout",
    lockTtlSeconds: 20,
    waitTimeoutMs: 20,
    pollIntervalMs: 10,
    retryAfterMs: 900,
    readCurrent: async () => null,
    generateAndPersist: async () => ({ ok: true }),
  });

  assert.equal(result.status, "processing");
  assert.equal(result.retryAfterMs, 900);
});
