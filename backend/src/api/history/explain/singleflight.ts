import {
  runSingleFlight,
  type RunSingleFlightParams,
  type SingleFlightResult,
} from "../../../utils/singleflight.js";
import { Types } from "mongoose";
import { HistoryDetail, HistoryPlayerResult } from "../../../models/History.js";
import { toAiEnvelope } from "../shared.js";

export type ExplainEnvelope<TPayload> = {
  payload: TPayload;
  model: string;
  createdAt: string;
  schemaVersion: number;
};

export const EXPLAIN_SINGLEFLIGHT_CONFIG = {
  lockTtlSeconds: Number(process.env.EXPLAIN_LOCK_TTL_SECONDS ?? 120),
  waitTimeoutMs: Number(process.env.EXPLAIN_WAIT_TIMEOUT_MS ?? 30_000),
  pollIntervalMs: Number(process.env.EXPLAIN_POLL_INTERVAL_MS ?? 500),
  retryAfterMs: Number(process.env.EXPLAIN_RETRY_AFTER_MS ?? 1_000),
};

export async function runExplainSingleFlight<T>({
  ...params
}: RunSingleFlightParams<T>): Promise<SingleFlightResult<T>> {
  return runSingleFlight(params);
}

export function toExplainEnvelope<TPayload>(x: {
  payload: TPayload;
  model: string;
  createdAt: string;
  schemaVersion?: number;
}): ExplainEnvelope<TPayload> {
  return toAiEnvelope(x);
}

export async function readHostExplainEnvelopeFromDb<TPayload>(params: {
  gameId: string;
  questionIndex: number;
  isCachedPayload: (x: unknown) => x is {
    payload: TPayload;
    model: string;
    createdAt: string;
    schemaVersion?: number;
  };
}): Promise<ExplainEnvelope<TPayload> | null> {
  const freshDetail = await HistoryDetail.findById(params.gameId)
    .select({ hostAiExplanations: 1 })
    .lean();
  const hostCache = (freshDetail as { hostAiExplanations?: unknown[] } | null)
    ?.hostAiExplanations;
  const hit = hostCache?.find(
    (e: any) => e?.questionIndex === params.questionIndex,
  );
  return params.isCachedPayload(hit) ? toExplainEnvelope(hit) : null;
}

export async function readPlayerExplainEnvelopeFromDb<TPayload>(params: {
  gameId: Types.ObjectId;
  userId: Types.ObjectId;
  questionIndex: number;
  isCachedPayload: (x: unknown) => x is {
    payload: TPayload;
    model: string;
    createdAt: string;
    schemaVersion?: number;
  };
}): Promise<ExplainEnvelope<TPayload> | null> {
  const freshPlayerResult = await HistoryPlayerResult.findOne({
    gameId: params.gameId,
    "player.userId": params.userId,
  })
    .select({ answers: 1 })
    .lean();

  const hit = freshPlayerResult?.answers?.find(
    (a) => a.questionIndex === params.questionIndex,
  )?.aiExplanation;
  return params.isCachedPayload(hit) ? toExplainEnvelope(hit) : null;
}

export function buildExplainLockKey(params: {
  gameId: string;
  questionIndex: number;
  scope: "host" | "player";
  actorId: string;
}) {
  const safeActorId = params.actorId.trim() || "unknown";
  return `history:explain:${params.scope}:${params.gameId}:${params.questionIndex}:${safeActorId}`;
}
