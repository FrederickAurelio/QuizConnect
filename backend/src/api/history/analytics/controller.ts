import { Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { handleControllerError } from "../../../utils/handle-control-error.js";
import { HistoryDetail, HistoryPlayerResult } from "../../../models/History.js";
import {
  completeChatJson,
  OPENROUTER_MODEL,
} from "../../../utils/openrouter.js";
import { logExplain } from "../../../utils/ai-explain-log.js";
import { buildHostSessionFacts, buildPlayerSessionFacts } from "./facts.js";
import {
  ANALYTICS_SINGLEFLIGHT_CONFIG,
  buildAnalyticsLockKey,
  readHostAnalyticsEnvelopeFromDb,
  readPlayerAnalyticsEnvelopeFromDb,
  runAnalyticsSingleFlight,
  toAnalyticsEnvelope,
  type AnalyticsEnvelope,
} from "./singleflight.js";
import {
  handleAiControllerError,
  buildAiCacheEntry,
  isAiCacheEnvelope,
  parseJsonWithOptionalFence,
} from "../shared.js";

const analyticsBodySchema = z.object({
  viewAs: z.enum(["host", "player"]).optional(),
});

const evidenceSchema = z.object({
  questionIndices: z.array(z.number().int().min(0)).max(10).default([]),
});

const insightSchema = z.object({
  title: z.string().min(1),
  detail: z.string().min(1),
  evidence: evidenceSchema.optional(),
  relatedQuestionIndices: z.array(z.number().int().min(0)).max(10).optional(),
});

const analyticsPayloadSchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(insightSchema).max(6),
  weaknesses: z.array(insightSchema).max(6),
  recommendations: z.array(insightSchema).max(6),
});

type AnalyticsPayload = z.infer<typeof analyticsPayloadSchema>;

function parseAnalyticsJson(raw: string): AnalyticsPayload | null {
  return parseJsonWithOptionalFence(raw, analyticsPayloadSchema);
}

function buildCacheEntry(payload: AnalyticsPayload, model: string) {
  return buildAiCacheEntry(payload, model);
}

function isCachedPayload(
  x: unknown,
): x is { payload: AnalyticsPayload; model: string; createdAt: string } {
  return isAiCacheEnvelope(x, analyticsPayloadSchema);
}

function normalizePayload(payload: AnalyticsPayload): AnalyticsPayload {
  const normalizeInsight = (item: z.infer<typeof insightSchema>) => ({
    title: item.title,
    detail: item.detail,
    evidence: {
      questionIndices: item.evidence?.questionIndices ?? [],
    },
    relatedQuestionIndices: item.relatedQuestionIndices ?? [],
  });
  return {
    summary: payload.summary,
    strengths: payload.strengths.map(normalizeInsight),
    weaknesses: payload.weaknesses.map(normalizeInsight),
    recommendations: payload.recommendations.map(normalizeInsight),
  };
}

function resolveAnalyticsMode(params: {
  isHost: boolean;
  viewAs?: "host" | "player";
  hostCanPlay: boolean;
  hostPlayed: boolean;
}): "host" | "player" {
  const { isHost, viewAs, hostCanPlay, hostPlayed } = params;
  if (!isHost) return "player";
  if (viewAs !== "player") return "host";
  return hostCanPlay && hostPlayed ? "player" : "host";
}

const ANALYTICS_JSON_SHAPE = `{
  "summary": string,
  "strengths": [{"title": string, "detail": string, "evidence": {"questionIndices": number[]}}],
  "weaknesses": [{"title": string, "detail": string, "evidence": {"questionIndices": number[]}}],
  "recommendations": [{"title": string, "detail": string, "relatedQuestionIndices": number[]}]
}`;

const SYSTEM_HOST = `You are an analytics tutor for quiz hosts reviewing one completed session.
Output ONLY one JSON object, no markdown fences, no extra text.

MUST rules:
- Use ONLY facts from input JSON; never invent numbers or events.
- Host mode allows class-level analysis; never mention individual identities.
- Raw score is influenced by session size and answer timing; prioritize correctness signals over raw score.
- Prose must use 1-based labels ("Question N") only.
- Never use the words "index" or "indices" in prose.
- Keep 0-based values only inside evidence.questionIndices / relatedQuestionIndices arrays.

Grouping contract (critical):
- Do NOT create one item per question unless grouping is impossible.
- Strengths should be 1-3 grouped concept buckets.
- Weaknesses should be 2-3 grouped misconception buckets when evidence allows.
- Each recommendation should map to one weakness bucket (1:1 preferred).

Item quality rules:
- Titles are concept-first (3-8 words), not generic.
- Details explain why the pattern happens (cause/mechanism), not just what question was wrong.
- If concept inference is weak, use one cautious grouped fallback label (e.g., "Mixed misconception pattern").

Section requirements:
- summary: 2-4 sentences with overall performance, hardest/easiest areas, and one teaching priority.
- strengths[]: grouped class strengths with evidence.questionIndices.
- weaknesses[]: grouped class weaknesses with evidence.questionIndices.
- recommendations[]: concrete reteaching actions (method + focus questions + expected learning gain) with relatedQuestionIndices.

Output shape:
${ANALYTICS_JSON_SHAPE}
`;

const SYSTEM_PLAYER = `You are a personal quiz coach for one learner reviewing one completed session.
Output ONLY one JSON object, no markdown fences, no extra text.

MUST rules:
- Use ONLY facts from input JSON; never invent numbers or events.
- Focus only on this learner; do NOT mention, infer, or compare to other players.
- Interpret accuracy as whole-session correctness (correctCount/questionCount); unanswered questions reduce accuracy.
- Raw score is influenced by session size and answer timing; prioritize correctness signals over raw score.
- Prose must use 1-based labels ("Question N") only.
- Never use the words "index" or "indices" in prose.
- Keep 0-based values only inside evidence.questionIndices / relatedQuestionIndices arrays.

Grouping contract (critical):
- Do NOT create one item per question unless grouping is impossible.
- Strengths should be 1-3 grouped skill buckets.
- Weaknesses should be 2-3 grouped skill-gap buckets when evidence allows.
- If topic signal is weak, produce one grouped fallback weakness (not many per-question items).
- Recommendations should map to weakness buckets (1:1 preferred).

Item quality rules:
- Titles are skill-gap first (3-8 words), not generic.
- Weakness detail must include likely error mechanism (recall gap, concept confusion, distractor confusion, misread prompt, or time-pressure omission).
- Recommendation detail must include a concrete method and cadence (e.g., short daily drill).
- Do not output shallow restatements like "Question X was wrong" as the main insight.

Section requirements:
- summary: 2-4 sentences with score/accuracy/completion and the main learning pattern.
- strengths[]: grouped learner strengths with evidence.questionIndices.
- weaknesses[]: grouped learner gaps with evidence.questionIndices.
- recommendations[]: concrete next-study plan (what + how + cadence) with relatedQuestionIndices.

Output shape:
${ANALYTICS_JSON_SHAPE}
`;

async function requestAnalyticsPayload(
  mode: "host" | "player",
  facts: unknown,
): Promise<{ payload: AnalyticsPayload; model: string }> {
  const systemPrompt = mode === "host" ? SYSTEM_HOST : SYSTEM_PLAYER;
  const factsJson = JSON.stringify(facts);

  let { content, model } = await completeChatJson({
    model: process.env.OPENROUTER_ANALYTICS_MODEL?.trim() || OPENROUTER_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: factsJson },
    ],
  });

  let parsed = parseAnalyticsJson(content);
  if (parsed) return { payload: normalizePayload(parsed), model };

  logExplain("analytics: first assistant reply invalid JSON, retrying");

  ({ content, model } = await completeChatJson({
    model: process.env.OPENROUTER_ANALYTICS_MODEL?.trim() || OPENROUTER_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: factsJson },
      { role: "assistant", content },
      {
        role: "user",
        content:
          "Your previous output was invalid. Reply with exactly one JSON object matching this shape: " +
          ANALYTICS_JSON_SHAPE,
      },
    ],
  }));

  parsed = parseAnalyticsJson(content);
  if (!parsed) {
    const err = new Error("AI analytics could not be parsed as valid JSON.");
    (err as any).statusCode = 502;
    throw err;
  }
  return { payload: normalizePayload(parsed), model };
}

export const postHistorySessionAnalytics = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.session.userId;
    if (!userId || req.session.type !== "auth") {
      return res.status(401).json({
        message: "Unauthorized: You must be logged in to access this route",
        data: null,
        errors: null,
      });
    }

    const gameId = req.params.gameId;
    if (!gameId || !Types.ObjectId.isValid(gameId)) {
      return res.status(404).json({
        message: "History Game not found",
        data: null,
        errors: null,
      });
    }

    const userIdStr = String(userId);
    const body = analyticsBodySchema.parse(req.body ?? {});
    const detail = await HistoryDetail.findById(gameId).lean();
    if (!detail) {
      return res.status(404).json({
        message: "History Game not found",
        data: null,
        errors: null,
      });
    }

    const hostIdStr = String(detail.host);
    const isHost = hostIdStr === userIdStr;
    const hostCanPlay = !!detail.settings?.hostCanPlay;

    const userObjectId = new Types.ObjectId(userIdStr);
    const userPlayerResult = await HistoryPlayerResult.findOne({
      gameId: detail._id,
      "player.userId": userObjectId,
    })
      .select({ _id: 1 })
      .lean();

    const isParticipant = !!userPlayerResult;
    if (!isHost && !isParticipant) {
      return res.status(403).json({
        message: "You do not have access to analytics for this game",
        data: null,
        errors: null,
      });
    }

    const mode = resolveAnalyticsMode({
      isHost,
      hostCanPlay,
      hostPlayed: isParticipant,
      ...(body.viewAs ? { viewAs: body.viewAs } : {}),
    });

    if (mode === "host") {
      const hit = (detail as { hostAiAnalytics?: unknown }).hostAiAnalytics;
      if (isCachedPayload(hit)) {
        return res.status(200).json({
          message: "AI analytics loaded from cache",
          data: {
            analytics: toAnalyticsEnvelope(hit),
            cached: true,
          },
          errors: null,
        });
      }

      const singleFlight = await runAnalyticsSingleFlight<
        AnalyticsEnvelope<AnalyticsPayload>
      >({
        lockKey: buildAnalyticsLockKey({
          gameId,
          scope: "host",
          actorId: hostIdStr,
        }),
        lockTtlSeconds: ANALYTICS_SINGLEFLIGHT_CONFIG.lockTtlSeconds,
        waitTimeoutMs: ANALYTICS_SINGLEFLIGHT_CONFIG.waitTimeoutMs,
        pollIntervalMs: ANALYTICS_SINGLEFLIGHT_CONFIG.pollIntervalMs,
        retryAfterMs: ANALYTICS_SINGLEFLIGHT_CONFIG.retryAfterMs,
        readCurrent: () =>
          readHostAnalyticsEnvelopeFromDb({
            gameId,
            isCachedPayload,
          }),
        generateAndPersist: async () => {
          const playerDocs = await HistoryPlayerResult.find({
            gameId: detail._id as Types.ObjectId,
          })
            .select({ player: 1, totalScore: 1, rank: 1, answers: 1 })
            .lean();

          const facts = buildHostSessionFacts({
            detail: detail as any,
            playerDocs: playerDocs as any,
          });
          const { payload, model } = await requestAnalyticsPayload(
            "host",
            facts,
          );
          const entry = buildCacheEntry(payload, model);
          await HistoryDetail.updateOne(
            { _id: detail._id },
            { $set: { hostAiAnalytics: entry } },
          );
          return toAnalyticsEnvelope(entry);
        },
      });

      if (singleFlight.status === "processing") {
        return res.status(202).json({
          message: "Analytics is still being generated",
          data: {
            status: "processing",
            retryAfterMs: singleFlight.retryAfterMs,
          },
          errors: null,
        });
      }

      return res.status(200).json({
        message: singleFlight.coalesced
          ? "AI analytics loaded from in-flight request"
          : "AI analytics generated successfully",
        data: {
          analytics: singleFlight.data,
          cached: false,
          coalesced: singleFlight.coalesced,
        },
        errors: null,
      });
    }

    const playerResult = await HistoryPlayerResult.findOne({
      gameId: detail._id,
      "player.userId": userObjectId,
    }).lean();
    if (!playerResult) {
      return res.status(403).json({
        message: "You do not have access to analytics for this game",
        data: null,
        errors: null,
      });
    }

    if (
      isCachedPayload(
        (playerResult as { aiSessionAnalytics?: unknown }).aiSessionAnalytics,
      )
    ) {
      return res.status(200).json({
        message: "AI analytics loaded from cache",
        data: {
          analytics: toAnalyticsEnvelope(
            (playerResult as { aiSessionAnalytics: any }).aiSessionAnalytics,
          ),
          cached: true,
        },
        errors: null,
      });
    }

    const singleFlight = await runAnalyticsSingleFlight<
      AnalyticsEnvelope<AnalyticsPayload>
    >({
      lockKey: buildAnalyticsLockKey({
        gameId,
        scope: "player",
        actorId: String(userObjectId),
      }),
      lockTtlSeconds: ANALYTICS_SINGLEFLIGHT_CONFIG.lockTtlSeconds,
      waitTimeoutMs: ANALYTICS_SINGLEFLIGHT_CONFIG.waitTimeoutMs,
      pollIntervalMs: ANALYTICS_SINGLEFLIGHT_CONFIG.pollIntervalMs,
      retryAfterMs: ANALYTICS_SINGLEFLIGHT_CONFIG.retryAfterMs,
      readCurrent: () =>
        readPlayerAnalyticsEnvelopeFromDb({
          gameId: detail._id as Types.ObjectId,
          userId: userObjectId,
          isCachedPayload,
        }),
      generateAndPersist: async () => {
        const facts = buildPlayerSessionFacts({
          detail: detail as any,
          playerDoc: playerResult as any,
          userId: userIdStr,
        });

        const { payload, model } = await requestAnalyticsPayload(
          "player",
          facts,
        );
        const entry = buildCacheEntry(payload, model);

        await HistoryPlayerResult.updateOne(
          { _id: playerResult._id },
          { $set: { aiSessionAnalytics: entry } },
        );
        return toAnalyticsEnvelope(entry);
      },
    });

    if (singleFlight.status === "processing") {
      return res.status(202).json({
        message: "Analytics is still being generated",
        data: {
          status: "processing",
          retryAfterMs: singleFlight.retryAfterMs,
        },
        errors: null,
      });
    }

    return res.status(200).json({
      message: singleFlight.coalesced
        ? "AI analytics loaded from in-flight request"
        : "AI analytics generated successfully",
      data: {
        analytics: singleFlight.data,
        cached: false,
        coalesced: singleFlight.coalesced,
      },
      errors: null,
    });
  } catch (error) {
    const aiError = handleAiControllerError(error, {
      missingKeyMessage: "AI analytics is not configured on the server",
      parseFailMessage: "Failed to generate AI analytics",
    });
    if (aiError) {
      return res.status(aiError.status).json(aiError.body);
    }
    return handleControllerError(res, error);
  }
};
