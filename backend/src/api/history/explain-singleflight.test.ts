import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExplainLockKey,
  runExplainSingleFlight,
} from "./explain-singleflight.js";
import { redis } from "../../redis/index.js";

type RedisLike = {
  set: (
    key: string,
    value: string,
    options: { NX: boolean; EX: number },
  ) => Promise<"OK" | null>;
  eval: (script: string, args: { keys: string[]; arguments: string[] }) => Promise<number>;
};

const redisMock = redis as unknown as RedisLike;

test("buildExplainLockKey creates stable scoped keys", () => {
  const host = buildExplainLockKey({
    gameId: "g1",
    questionIndex: 2,
    scope: "host",
    actorId: "u1",
  });
  const player = buildExplainLockKey({
    gameId: "g1",
    questionIndex: 2,
    scope: "player",
    actorId: "u1",
  });

  assert.equal(host, "history:explain:host:g1:2:u1");
  assert.equal(player, "history:explain:player:g1:2:u1");
});

test("runExplainSingleFlight executes generate only once for owner", async () => {
  let releaseCalled = 0;
  redisMock.set = async () => "OK";
  redisMock.eval = async () => {
    releaseCalled += 1;
    return 1;
  };

  let generateCount = 0;
  const result = await runExplainSingleFlight({
    lockKey: "history:explain:host:g1:0:u1",
    lockTtlSeconds: 30,
    waitTimeoutMs: 30,
    pollIntervalMs: 5,
    retryAfterMs: 10,
    readCurrent: async () => null,
    generateAndPersist: async () => {
      generateCount += 1;
      return { model: "x" };
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(result.coalesced, false);
  assert.equal(generateCount, 1);
  assert.equal(releaseCalled, 1);
});

test("runExplainSingleFlight follower waits and returns coalesced result", async () => {
  redisMock.set = async () => null;
  redisMock.eval = async () => 0;

  let reads = 0;
  const result = await runExplainSingleFlight({
    lockKey: "history:explain:player:g1:0:u1",
    lockTtlSeconds: 30,
    waitTimeoutMs: 80,
    pollIntervalMs: 10,
    retryAfterMs: 10,
    readCurrent: async () => {
      reads += 1;
      if (reads < 2) return null;
      return { model: "from-owner" };
    },
    generateAndPersist: async () => ({ model: "should-not-run" }),
  });

  assert.equal(result.status, "ready");
  assert.equal(result.coalesced, true);
  assert.deepEqual(result.data, { model: "from-owner" });
});

test("runExplainSingleFlight follower returns processing on timeout", async () => {
  redisMock.set = async () => null;
  redisMock.eval = async () => 0;

  const result = await runExplainSingleFlight({
    lockKey: "history:explain:player:g1:1:u1",
    lockTtlSeconds: 30,
    waitTimeoutMs: 20,
    pollIntervalMs: 10,
    retryAfterMs: 750,
    readCurrent: async () => null,
    generateAndPersist: async () => ({ model: "should-not-run" }),
  });

  assert.equal(result.status, "processing");
  assert.equal(result.retryAfterMs, 750);
});
