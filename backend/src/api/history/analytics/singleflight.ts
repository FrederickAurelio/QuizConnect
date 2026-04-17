import {
  runSingleFlight,
  type RunSingleFlightParams,
  type SingleFlightResult,
} from "../../../utils/singleflight.js";
import { Types } from "mongoose";
import { HistoryDetail, HistoryPlayerResult } from "../../../models/History.js";
import { toAiEnvelope } from "../shared.js";

export type AnalyticsEnvelope<TPayload> = {
  payload: TPayload;
  model: string;
  createdAt: string;
  schemaVersion: number;
};

export const ANALYTICS_SINGLEFLIGHT_CONFIG = {
  lockTtlSeconds: Number(process.env.ANALYTICS_LOCK_TTL_SECONDS ?? 120),
  waitTimeoutMs: Number(process.env.ANALYTICS_WAIT_TIMEOUT_MS ?? 30_000),
  pollIntervalMs: Number(process.env.ANALYTICS_POLL_INTERVAL_MS ?? 500),
  retryAfterMs: Number(process.env.ANALYTICS_RETRY_AFTER_MS ?? 1_000),
};

export async function runAnalyticsSingleFlight<T>({
  ...params
}: RunSingleFlightParams<T>): Promise<SingleFlightResult<T>> {
  return runSingleFlight(params);
}

export function toAnalyticsEnvelope<TPayload>(x: {
  payload: TPayload;
  model: string;
  createdAt: string;
  schemaVersion?: number;
}): AnalyticsEnvelope<TPayload> {
  return toAiEnvelope(x);
}

export async function readHostAnalyticsEnvelopeFromDb<TPayload>(params: {
  gameId: string;
  isCachedPayload: (x: unknown) => x is {
    payload: TPayload;
    model: string;
    createdAt: string;
    schemaVersion?: number;
  };
}): Promise<AnalyticsEnvelope<TPayload> | null> {
  const freshDetail = await HistoryDetail.findById(params.gameId)
    .select({ hostAiAnalytics: 1 })
    .lean();
  const hit = (freshDetail as { hostAiAnalytics?: unknown } | null)
    ?.hostAiAnalytics;
  return params.isCachedPayload(hit) ? toAnalyticsEnvelope(hit) : null;
}

export async function readPlayerAnalyticsEnvelopeFromDb<TPayload>(params: {
  gameId: Types.ObjectId;
  userId: Types.ObjectId;
  isCachedPayload: (x: unknown) => x is {
    payload: TPayload;
    model: string;
    createdAt: string;
    schemaVersion?: number;
  };
}): Promise<AnalyticsEnvelope<TPayload> | null> {
  const freshPlayerResult = await HistoryPlayerResult.findOne({
    gameId: params.gameId,
    "player.userId": params.userId,
  })
    .select({ aiSessionAnalytics: 1 })
    .lean();

  const hit = (freshPlayerResult as { aiSessionAnalytics?: unknown } | null)
    ?.aiSessionAnalytics;
  return params.isCachedPayload(hit) ? toAnalyticsEnvelope(hit) : null;
}

export function buildAnalyticsLockKey(params: {
  gameId: string;
  scope: "host" | "player";
  actorId: string;
}) {
  const safeActorId = params.actorId.trim() || "unknown";
  return `history:analytics:${params.scope}:${params.gameId}:${safeActorId}`;
}
