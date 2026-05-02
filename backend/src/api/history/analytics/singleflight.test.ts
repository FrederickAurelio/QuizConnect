import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAnalyticsLockKey,
  runAnalyticsSingleFlight,
} from "./singleflight.js";
import { redis } from "../../../redis/index.js";

type RedisLike = {
  set: (
    key: string,
    value: string,
    options: { NX: boolean; EX: number },
  ) => Promise<"OK" | null>;
  eval: (
    script: string,
    args: { keys: string[]; arguments: string[] },
  ) => Promise<number>;
};

const redisMock = redis as unknown as RedisLike;

test("buildAnalyticsLockKey creates stable scoped keys", () => {
  const host = buildAnalyticsLockKey({
    gameId: "g1",
    scope: "host",
    actorId: "u1",
  });
  const player = buildAnalyticsLockKey({
    gameId: "g1",
    scope: "player",
    actorId: "u1",
  });

  assert.equal(host, "history:analytics:host:g1:u1");
  assert.equal(player, "history:analytics:player:g1:u1");
});

test("runAnalyticsSingleFlight executes generate once for owner", async () => {
  let releaseCalled = 0;
  redisMock.set = async () => "OK";
  redisMock.eval = async () => {
    releaseCalled += 1;
    return 1;
  };

  let generateCount = 0;
  const result = await runAnalyticsSingleFlight({
    lockKey: "history:analytics:host:g1:u1",
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
