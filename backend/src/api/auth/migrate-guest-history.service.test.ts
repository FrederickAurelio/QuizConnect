import assert from "node:assert/strict";
import test from "node:test";
import { Types } from "mongoose";
import {
  HistoryDetail,
  HistoryPlayerResult,
  HistoryQuery,
} from "../../models/History.js";
import { migrateGuestHistoryToUser } from "./migrate-guest-history.service.js";

function stubMethod<T extends object, K extends keyof T>(
  target: T,
  key: K,
  impl: T[K],
) {
  const original = target[key];
  (target as Record<string, unknown>)[String(key)] = impl as unknown;
  return () => {
    (target as Record<string, unknown>)[String(key)] = original as unknown;
  };
}

test("migrateGuestHistoryToUser is idempotent and updates query players via addToSet targets", async () => {
  const guestId = "guest_123";
  const userId = new Types.ObjectId();
  const gameA = new Types.ObjectId();
  const gameB = new Types.ObjectId();

  let updateManyPlayerCalls = 0;
  let updateManyDetailCalls = 0;
  let updateManyWinnerCalls = 0;
  let bulkWriteCalls = 0;

  const restoreDistinctPlayer = stubMethod(
    HistoryPlayerResult,
    "distinct",
    (async () => [gameA, gameB]) as unknown as typeof HistoryPlayerResult.distinct,
  );
  const restoreDistinctDetail = stubMethod(
    HistoryDetail,
    "distinct",
    (async () => [gameB]) as unknown as typeof HistoryDetail.distinct,
  );
  const restoreUpdateManyPlayer = stubMethod(
    HistoryPlayerResult,
    "updateMany",
    (async () => {
      updateManyPlayerCalls += 1;
      if (updateManyPlayerCalls === 1) {
        return { matchedCount: 2, modifiedCount: 2 };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    }) as unknown as typeof HistoryPlayerResult.updateMany,
  );
  const restoreUpdateManyDetail = stubMethod(
    HistoryDetail,
    "updateMany",
    (async () => {
      updateManyDetailCalls += 1;
      if (updateManyDetailCalls === 1) {
        return { matchedCount: 1, modifiedCount: 1 };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    }) as unknown as typeof HistoryDetail.updateMany,
  );
  const restoreUpdateManyQuery = stubMethod(
    HistoryQuery,
    "updateMany",
    (async () => {
      updateManyWinnerCalls += 1;
      if (updateManyWinnerCalls === 1) {
        return { matchedCount: 1, modifiedCount: 1 };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    }) as unknown as typeof HistoryQuery.updateMany,
  );
  const restoreBulkWrite = stubMethod(
    HistoryQuery,
    "bulkWrite",
    (async (ops: unknown[]) => {
      bulkWriteCalls += 1;
      assert.equal(ops.length, 2);
      return { modifiedCount: bulkWriteCalls === 1 ? 2 : 0 };
    }) as unknown as typeof HistoryQuery.bulkWrite,
  );

  try {
    const first = await migrateGuestHistoryToUser({ guestId, userId });
    assert.equal(first.matchedPlayerResults, 2);
    assert.equal(first.modifiedPlayerResults, 2);
    assert.equal(first.matchedHistoryDetails, 1);
    assert.equal(first.modifiedHistoryDetails, 1);
    assert.equal(first.matchedWinners, 1);
    assert.equal(first.modifiedWinners, 1);
    assert.equal(first.historyQueriesChecked, 2);
    assert.equal(first.historyQueriesUpdated, 2);

    const second = await migrateGuestHistoryToUser({ guestId, userId });
    assert.equal(second.matchedPlayerResults, 0);
    assert.equal(second.modifiedPlayerResults, 0);
    assert.equal(second.matchedHistoryDetails, 0);
    assert.equal(second.modifiedHistoryDetails, 0);
    assert.equal(second.matchedWinners, 0);
    assert.equal(second.modifiedWinners, 0);
    assert.equal(second.historyQueriesChecked, 2);
    assert.equal(second.historyQueriesUpdated, 0);
  } finally {
    restoreDistinctPlayer();
    restoreDistinctDetail();
    restoreUpdateManyPlayer();
    restoreUpdateManyDetail();
    restoreUpdateManyQuery();
    restoreBulkWrite();
  }
});

test("migrateGuestHistoryToUser returns no-op for non-guest ids", async () => {
  const result = await migrateGuestHistoryToUser({
    guestId: "user_abc",
    userId: new Types.ObjectId(),
  });

  assert.deepEqual(result, {
    matchedPlayerResults: 0,
    modifiedPlayerResults: 0,
    matchedHistoryDetails: 0,
    modifiedHistoryDetails: 0,
    matchedWinners: 0,
    modifiedWinners: 0,
    historyQueriesChecked: 0,
    historyQueriesUpdated: 0,
  });
});

