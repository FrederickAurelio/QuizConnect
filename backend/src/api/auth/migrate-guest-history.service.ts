import { Types } from "mongoose";
import {
  HistoryDetail,
  HistoryPlayerResult,
  HistoryQuery,
} from "../../models/History.js";

export type MigrateGuestHistoryParams = {
  guestId: string;
  userId: Types.ObjectId;
};

export type MigrateGuestHistoryStats = {
  matchedPlayerResults: number;
  modifiedPlayerResults: number;
  matchedHistoryDetails: number;
  modifiedHistoryDetails: number;
  matchedWinners: number;
  modifiedWinners: number;
  historyQueriesChecked: number;
  historyQueriesUpdated: number;
};

function isGuestSessionId(value: string) {
  return /^guest_/.test(value);
}

export async function migrateGuestHistoryToUser(
  params: MigrateGuestHistoryParams,
): Promise<MigrateGuestHistoryStats> {
  const { guestId, userId } = params;

  if (!isGuestSessionId(guestId)) {
    return {
      matchedPlayerResults: 0,
      modifiedPlayerResults: 0,
      matchedHistoryDetails: 0,
      modifiedHistoryDetails: 0,
      matchedWinners: 0,
      modifiedWinners: 0,
      historyQueriesChecked: 0,
      historyQueriesUpdated: 0,
    };
  }

  const [playerGameIds, detailGameIds] = await Promise.all([
    HistoryPlayerResult.distinct("gameId", { "player.guestId": guestId }),
    HistoryDetail.distinct("_id", { "players.guestId": guestId }),
  ]);

  const gameIdSet = new Set<string>();
  for (const gameId of [...playerGameIds, ...detailGameIds]) {
    if (!gameId) continue;
    gameIdSet.add(String(gameId));
  }
  const gameObjectIds = Array.from(gameIdSet)
    .filter((x) => Types.ObjectId.isValid(x))
    .map((x) => new Types.ObjectId(x));

  const [playerResultUpdate, detailUpdate, winnerUpdate] = await Promise.all([
    HistoryPlayerResult.updateMany(
      { "player.guestId": guestId },
      {
        $set: {
          "player.userId": userId,
          "player.guestId": null,
        },
      },
    ),
    HistoryDetail.updateMany(
      { "players.guestId": guestId },
      {
        $set: {
          "players.$[p].userId": userId,
          "players.$[p].guestId": null,
        },
      },
      {
        arrayFilters: [{ "p.guestId": guestId }],
      },
    ),
    HistoryQuery.updateMany(
      { "winner.guestId": guestId },
      {
        $set: {
          "winner.userId": userId,
          "winner.guestId": null,
        },
      },
    ),
  ]);

  let historyQueriesUpdated = 0;
  if (gameObjectIds.length > 0) {
    const bulkResult = await HistoryQuery.bulkWrite(
      gameObjectIds.map((gameId) => ({
        updateOne: {
          filter: { _id: gameId },
          update: {
            $addToSet: { players: userId },
          },
        },
      })),
      { ordered: false },
    );
    historyQueriesUpdated = bulkResult.modifiedCount ?? 0;
  }

  return {
    matchedPlayerResults: playerResultUpdate.matchedCount ?? 0,
    modifiedPlayerResults: playerResultUpdate.modifiedCount ?? 0,
    matchedHistoryDetails: detailUpdate.matchedCount ?? 0,
    modifiedHistoryDetails: detailUpdate.modifiedCount ?? 0,
    matchedWinners: winnerUpdate.matchedCount ?? 0,
    modifiedWinners: winnerUpdate.modifiedCount ?? 0,
    historyQueriesChecked: gameObjectIds.length,
    historyQueriesUpdated,
  };
}

