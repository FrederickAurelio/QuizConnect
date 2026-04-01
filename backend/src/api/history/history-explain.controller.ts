import { Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { handleControllerError } from "../../utils/handle-control-error.js";
import { HistoryDetail, HistoryPlayerResult } from "../../models/History.js";
import { beginAiExplainLog, logExplain } from "../../utils/ai-explain-log.js";
import {
  completeChatJson,
  OPENROUTER_WEB_DECIDER_MODEL,
} from "../../utils/openrouter.js";
import { searchWebForQuestion, type WebSearchHit } from "../../utils/tavilySearch.js";

// --- Request / validation ---

const explainBodySchema = z.object({
  questionIndex: z.number().int().min(0),
});

const explanationSourceZ = z.object({
  title: z.string().min(1),
  urlOrNote: z.string().min(1),
});

const explanationPayloadZ = z.object({
  verifiedCorrectKey: z.enum(["A", "B", "C", "D"]),
  agreesWithQuizKey: z.boolean(),
  rationale: z.string().min(1),
  feedback: z.string().min(1),
  sources: z.array(explanationSourceZ).min(1).max(5),
});

type ExplanationPayload = z.infer<typeof explanationPayloadZ>;

// --- LLM JSON parsing & cache shape ---

function parseExplanationJson(raw: string): ExplanationPayload | null {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const toParse = jsonMatch ? jsonMatch[1]!.trim() : trimmed;
  try {
    const parsed = JSON.parse(toParse) as unknown;
    const out = explanationPayloadZ.safeParse(parsed);
    return out.success ? out.data : null;
  } catch {
    return null;
  }
}

function buildCacheEntry(payload: ExplanationPayload, model: string) {
  return {
    payload,
    model,
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  };
}

function isCachedPayload(
  x: unknown,
): x is { payload: ExplanationPayload; model: string; createdAt: string } {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const p = explanationPayloadZ.safeParse(o.payload);
  return (
    p.success && typeof o.model === "string" && typeof o.createdAt === "string"
  );
}

// --- Cost-optimized decision: do we need Tavily web evidence? ---

const webDecisionZ = z.object({
  needWeb: z.boolean(),
  reason: z.string().optional(),
});

type WebDecision = z.infer<typeof webDecisionZ>;

function parseWebDecisionJson(raw: string): WebDecision | null {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const toParse = jsonMatch ? jsonMatch[1]!.trim() : trimmed;
  try {
    const parsed = JSON.parse(toParse) as unknown;
    const out = webDecisionZ.safeParse(parsed);
    return out.success ? out.data : null;
  } catch {
    return null;
  }
}

const WEB_DECIDER_FALLBACK_NEED_WEB =
  (process.env.OPENROUTER_WEB_DECIDER_FALLBACK_NEED_WEB ?? "false")
    .toLowerCase() === "true";

async function decideNeedWebSearch(questionText: string | null | undefined): Promise<{
  needWeb: boolean;
  reason: string;
  modelUsed: string;
  usedMathHeuristic: boolean;
}> {
  const trimmedQuestionText = (questionText ?? "").trim();

  const trimmedQuestion = trimmedQuestionText;
  if (!trimmedQuestion) {
    return {
      needWeb: false,
      reason: "empty question text",
      modelUsed: "local-heuristic",
      usedMathHeuristic: false,
    };
  }

  const systemPrompt = `You are a cost-aware assistant for a quiz app.
Decide whether we need real-time web search evidence to answer the question accurately.

Rules:
- If the question is deterministic math/arithmetic/logic that can be solved without web, set needWeb=false.
- If the question asks for facts that may not be reliably known or may require citations, set needWeb=true.
- Cost-aware default: if unsure, choose needWeb=false.
- Only choose needWeb=true when you think web evidence is genuinely needed for high accuracy.

Output ONLY one JSON object (no markdown) with:
{"needWeb": boolean, "reason": string}
`;

  const userContent = JSON.stringify({
    question: trimmedQuestion,
  });

  let content: string;
  let usedModel: string;
  try {
    ({ content, model: usedModel } = await completeChatJson({
      model: OPENROUTER_WEB_DECIDER_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    }));
  } catch (e: any) {
    logExplain("explain: web decider failed (OpenRouter error)", {
      message: e?.message ?? String(e),
      fallbackNeedWeb: WEB_DECIDER_FALLBACK_NEED_WEB,
    });
    return {
      needWeb: WEB_DECIDER_FALLBACK_NEED_WEB,
      reason: "web decider failed; using fallback",
      modelUsed: OPENROUTER_WEB_DECIDER_MODEL,
      usedMathHeuristic: false,
    };
  }

  const parsed = parseWebDecisionJson(content);
  if (parsed) {
    return {
      needWeb: parsed.needWeb,
      reason: parsed.reason ?? "no reason provided",
      modelUsed: usedModel,
      usedMathHeuristic: false,
    };
  }

  logExplain("explain: web decider failed (invalid JSON)", {
    contentPreview: content.slice(0, 220),
    fallbackNeedWeb: WEB_DECIDER_FALLBACK_NEED_WEB,
  });

  return {
    needWeb: WEB_DECIDER_FALLBACK_NEED_WEB,
    reason: "invalid JSON from decider; using fallback",
    modelUsed: usedModel,
    usedMathHeuristic: false,
  };
}

// --- Host participant rows (aligned with stored optionIndex → A–D) ---

const OPTION_INDEX_TO_KEY = ["A", "B", "C", "D"] as const;

function displayNameForParticipantId(
  detailPlayers: {
    userId?: Types.ObjectId | null;
    guestId?: string | null;
    username?: string | null;
  }[],
  participantId: Types.ObjectId | string,
) {
  const id = String(participantId);
  const row = detailPlayers.find(
    (p) => String(p.userId ?? "") === id || String(p.guestId ?? "") === id,
  );
  return row?.username ?? "Player";
}

/** One entry per player; didAnswer false when no answer row for this question. */
function buildHostParticipantChoicesForQuestion(
  detailPlayers: {
    userId?: Types.ObjectId | null;
    guestId?: string | null;
    username?: string | null;
  }[],
  playerDocs: {
    player: {
      userId?: Types.ObjectId | null;
      guestId?: string | null;
      username?: string | null;
    };
    answers: {
      questionIndex: number;
      key?: string | null;
      score?: number;
      optionIndex?: number | null;
    }[];
  }[],
  questionIndex: number,
) {
  return playerDocs.map((doc) => {
    const ans = doc.answers.find((a) => a.questionIndex === questionIndex);
    const pid = doc.player?.userId ?? doc.player?.guestId;
    const displayName =
      pid != null
        ? displayNameForParticipantId(detailPlayers, pid)
        : (doc.player?.username ?? "Player");
    return {
      displayName,
      didAnswer: !!ans,
      chosenKey:
        ans?.optionIndex != null
          ? OPTION_INDEX_TO_KEY[ans.optionIndex]
          : null,
      score: ans?.score ?? null,
    };
  });
}

// --- OpenRouter prompts & request ---

const EXPLAIN_JSON_SHAPE = `{"verifiedCorrectKey":"A"|"B"|"C"|"D","agreesWithQuizKey":boolean,"rationale":string,"feedback":string,"sources":[{"title":string,"urlOrNote":string}]}`;

const SYSTEM_PLAYER = `You are an educational tutor for a multiple-choice quiz. You will receive the question, options, the quiz author's marked correct key, the learner's answer, and optionally webSearchResults.

Rules:
- Output ONLY one JSON object, no markdown fences, no extra text.
- If webSearchResults is non-empty, treat it as evidence:
  - Derive verifiedCorrectKey by mapping the webSearchResults snippets to the provided option texts.
  - sources: 1-3 items (title + urlOrNote).
  - sources MUST reference ONLY URLs that exist inside webSearchResults.
    - For every sources[].urlOrNote that is a URL, copy it verbatim from one of webSearchResults[].url values.
    - sources[].title must match the title from the same webSearchResults entry.
- Set agreesWithQuizKey:
  - Set agreesWithQuizKey=true only when the evidence clearly supports that the quiz's marked correct key matches the verifiedCorrectKey.
  - If evidence is weak, conflicting, or does not clearly map to a single option, set agreesWithQuizKey=false and explain the uncertainty in rationale.
- In rationale, explain the topic clearly and reference the evidence you used. In feedback, address this specific learner: whether they were right or wrong relative to the verified answer, and how to reason about similar questions.
- If webSearchResults is empty, you may answer using prior knowledge, and sources[].urlOrNote may be a short knowledge note.

JSON shape: ${EXPLAIN_JSON_SHAPE}`;

const SYSTEM_HOST = `You are an educational tutor helping a quiz host review one question after a live game. You will receive the question, options, the quiz author's marked correct key, one row per participant (displayName, didAnswer, chosenKey, score), and optionally webSearchResults.

Rules:
- Output ONLY one JSON object, no markdown fences, no extra text.
- If webSearchResults is non-empty, treat it as evidence:
  - Derive verifiedCorrectKey by mapping the webSearchResults snippets to the provided option texts.
  - sources: 1-3 items (title + urlOrNote).
  - sources MUST reference ONLY URLs that exist inside webSearchResults.
    - For every sources[].urlOrNote that is a URL, copy it verbatim from one of webSearchResults[].url values.
    - sources[].title must match the title from the same webSearchResults entry.
- Set agreesWithQuizKey:
  - Set agreesWithQuizKey=true only when the evidence clearly supports that the quiz's marked correct key matches the verifiedCorrectKey.
  - If evidence is weak, conflicting, or does not clearly map to a single option, set agreesWithQuizKey=false and explain the uncertainty in rationale.
- In rationale, explain the topic and reference the evidence you used. In feedback, summarize how the group performed: how many did not answer (didAnswer false), distribution of chosenKey among those who did, common misconceptions, all relative to the verified answer.
- If webSearchResults is empty, you may answer using prior knowledge, and sources[].urlOrNote may be a short knowledge note.

JSON shape: ${EXPLAIN_JSON_SHAPE}`;

async function requestExplanationPayload(
  systemPrompt: string,
  userContent: string,
): Promise<{ payload: ExplanationPayload; model: string }> {
  let { content, model } = await completeChatJson({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  let parsed = parseExplanationJson(content);
  if (parsed) return { payload: parsed, model };

  logExplain(
    "explain: first assistant reply was not valid JSON — retrying with repair instruction",
  );

  ({ content, model } = await completeChatJson({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
      { role: "assistant", content },
      {
        role: "user",
        content: `That response was invalid. Reply with exactly one JSON object matching this shape (no markdown): ${EXPLAIN_JSON_SHAPE}. Use 1-3 sources.`,
      },
    ],
  }));

  parsed = parseExplanationJson(content);
  if (!parsed) {
    const err = new Error("AI explanation could not be parsed as valid JSON.");
    (err as any).statusCode = 502;
    throw err;
  }
  return { payload: parsed, model };
}

// --- Route handler ---

export const postHistoryQuestionExplain = async (
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

    const body = explainBodySchema.parse(req.body);
    const questionIndex = body.questionIndex;

    const detail = await HistoryDetail.findById(gameId).lean();
    if (!detail) {
      return res.status(404).json({
        message: "History Game not found",
        data: null,
        errors: null,
      });
    }

    const questions = detail.quiz?.questions ?? [];
    if (questionIndex >= questions.length) {
      return res.status(400).json({
        message: "Invalid question index",
        data: null,
        errors: null,
      });
    }

    const questionUnparsed = questions[questionIndex]!;
    const quizCorrectKeyIndex = questionUnparsed.options.findIndex(
      (opt) => opt.key === questionUnparsed.correctKey,
    );

    const question = {
      ...questionUnparsed,
      options: questionUnparsed.options.map((opt, index) => ({
        ...opt,
        key: OPTION_INDEX_TO_KEY[index],
      })),
      correctKey:
        quizCorrectKeyIndex !== -1
          ? OPTION_INDEX_TO_KEY[quizCorrectKeyIndex]
          : null,
    };
    const quizCorrectKey = question.correctKey;

    beginAiExplainLog({
      gameId,
      questionIndex,
      userId,
      quizTitle: detail.quiz?.title,
      isHost: String(detail.host) === String(userId),
    });
    logExplain("explain: question from DB", {
      id: (question as { id?: string }).id,
      question: question.question,
      correctKey: question.correctKey,
      options: question.options,
    });

    if (!quizCorrectKey || !["A", "B", "C", "D"].includes(quizCorrectKey)) {
      return res.status(400).json({
        message: "Question has no valid correct key stored",
        data: null,
        errors: null,
      });
    }

    const hostIdStr = String(detail.host);
    const isHost = hostIdStr === String(userId);

    if (isHost) {
      const hostCache = (detail as { hostAiExplanations?: unknown[] })
        .hostAiExplanations;
      const hit = hostCache?.find(
        (e: any) => e?.questionIndex === questionIndex,
      );
      if (isCachedPayload(hit)) {
        logExplain("explain: host cache HIT — skipping Tavily + OpenRouter");
        return res.status(200).json({
          message: "AI explanation loaded from cache",
          data: {
            explanation: {
              payload: hit.payload,
              model: hit.model,
              createdAt: hit.createdAt,
              schemaVersion: (hit as any).schemaVersion ?? 1,
            },
            cached: true,
          },
          errors: null,
        });
      }

      logExplain("explain: host path — generating (no cache)");

      const playerDocs = await HistoryPlayerResult.find({
        gameId: detail._id as Types.ObjectId,
      })
        .select({ player: 1, answers: 1 })
        .lean();

      const detailPlayers =
        (
          detail as {
            players?: {
              userId?: Types.ObjectId | null;
              guestId?: string | null;
              username?: string | null;
            }[];
          }
        ).players ?? [];

      const participantChoices = buildHostParticipantChoicesForQuestion(
        detailPlayers,
        playerDocs,
        questionIndex,
      );

      logExplain(
        "explain: host participantChoices (per player, includes didAnswer)",
        {
          count: participantChoices.length,
          participantChoices,
        },
      );

      const optionsAsText = (question.options ?? [])
        .map((opt: any, idx: number) => `Option ${OPTION_INDEX_TO_KEY[idx]}: ${opt.text}`)
        .join("\n");

      const webQuery = `Question: ${question.question}\n${optionsAsText}`;
      const webDecision = await decideNeedWebSearch(question.question ?? "");
      logExplain("explain: webSearch decision (host)", {
        needWeb: webDecision.needWeb,
        reason: webDecision.reason,
        modelUsed: webDecision.modelUsed,
        usedMathHeuristic: webDecision.usedMathHeuristic,
      });

      let webSearchResultsRaw: WebSearchHit[] = [];
      if (webDecision.needWeb) {
        logExplain("explain: Tavily fetch enabled (decider)", {
          webQueryLength: webQuery.length,
        });
        webSearchResultsRaw = await searchWebForQuestion(webQuery);
      } else {
        logExplain("explain: Tavily skipped (decider)", {
          reason: webDecision.reason,
        });
      }
      const seenUrls = new Set<string>();
      const webSearchResults = webSearchResultsRaw.filter((r) => {
        if (seenUrls.has(r.url)) return false;
        seenUrls.add(r.url);
        return true;
      });

      logExplain("explain: host webSearchResults (injected into user JSON)", {
        hitCount: webSearchResults.length,
        webSearchResults,
      });

      const userContent = JSON.stringify(
        {
          mode: "host",
          questionIndex,
          question: question.question,
          options: question.options,
          quizMarkedCorrectKey: quizCorrectKey,
          participantChoices,
          webSearchResults,
        },
        null,
        2,
      );

      logExplain(
        "explain: host → user message to OpenRouter (string passed as user role content)",
        userContent,
      );

      let payload: ExplanationPayload;
      let model: string;
      try {
        ({ payload, model } = await requestExplanationPayload(
          SYSTEM_HOST,
          userContent,
        ));
      } catch (e: any) {
        if (
          e?.message === "OPENROUTER_API_KEY environment variable is not set."
        ) {
          return res.status(503).json({
            message: "AI explanation is not configured on the server",
            data: null,
            errors: null,
          });
        }
        return res.status(502).json({
          message:
            e?.statusCode === 502
              ? e.message
              : "Failed to generate AI explanation",
          data: null,
          errors: null,
        });
      }

      const entry = {
        questionIndex,
        ...buildCacheEntry(payload, model),
      };

      const existing = (detail as { hostAiExplanations?: unknown[] })
        .hostAiExplanations;
      const next = [
        ...(existing ?? []).filter(
          (e: any) => e?.questionIndex !== questionIndex,
        ),
        entry,
      ];

      await HistoryDetail.updateOne(
        { _id: detail._id },
        { $set: { hostAiExplanations: next } },
      );

      logExplain("explain: host done — persisted hostAiExplanations", {
        questionIndex,
        model,
      });

      return res.status(200).json({
        message: "AI explanation generated successfully",
        data: {
          explanation: {
            payload,
            model,
            createdAt: entry.createdAt,
            schemaVersion: entry.schemaVersion,
          },
          cached: false,
        },
        errors: null,
      });
    }

    const userObjectId = new Types.ObjectId(userId);
    const playerResult = await HistoryPlayerResult.findOne({
      gameId: detail._id,
      "player.userId": userObjectId,
    }).lean();

    if (!playerResult) {
      return res.status(403).json({
        message: "You do not have access to explanations for this game",
        data: null,
        errors: null,
      });
    }

    const myAnswer = playerResult.answers.find(
      (a) => a.questionIndex === questionIndex,
    );
    const cachedExplain = myAnswer?.aiExplanation;
    if (isCachedPayload(cachedExplain)) {
      logExplain("explain: player cache HIT — skipping Tavily + OpenRouter");
      return res.status(200).json({
        message: "AI explanation loaded from cache",
        data: {
          explanation: {
            payload: cachedExplain.payload,
            model: cachedExplain.model,
            createdAt: cachedExplain.createdAt,
            schemaVersion: (cachedExplain as any).schemaVersion ?? 1,
          },
          cached: true,
        },
        errors: null,
      });
    }

    logExplain("explain: player path — generating (no cache)");
    logExplain(
      "explain: player HistoryPlayerResult answers (full array from DB)",
      {
        gameId: String(detail._id),
        answersCount: playerResult.answers?.length ?? 0,
        answers: playerResult.answers,
      },
    );
    logExplain("explain: player answer row for this questionIndex", {
      questionIndex,
      myAnswer,
    });

    const webQuery = `Question: ${question.question}\n${(question.options ?? [])
      .map((opt: any, idx: number) => `Option ${OPTION_INDEX_TO_KEY[idx]}: ${opt.text}`)
      .join("\n")}`;

    const webDecision = await decideNeedWebSearch(question.question ?? "");
    logExplain("explain: webSearch decision (player)", {
      needWeb: webDecision.needWeb,
      reason: webDecision.reason,
      modelUsed: webDecision.modelUsed,
      usedMathHeuristic: webDecision.usedMathHeuristic,
    });

    let webSearchResults: WebSearchHit[] = [];
    if (webDecision.needWeb) {
      logExplain("explain: Tavily fetch enabled (decider)", {
        webQueryLength: webQuery.length,
      });
      webSearchResults = await searchWebForQuestion(webQuery);
    } else {
      logExplain("explain: Tavily skipped (decider)", {
        reason: webDecision.reason,
      });
    }

    logExplain("explain: player webSearchResults (injected into user JSON)", {
      hitCount: webSearchResults.length,
      webSearchResults,
    });

    const userContent = JSON.stringify(
      {
        mode: "player",
        questionIndex,
        question: question.question,
        options: question.options,
        quizMarkedCorrectKey: quizCorrectKey,
        learnerChosenKey:
          myAnswer?.optionIndex != null
            ? OPTION_INDEX_TO_KEY[myAnswer.optionIndex]
            : null,
        learnerScore: myAnswer?.score ?? null,
        webSearchResults,
      },
      null,
      2,
    );

    logExplain(
      "explain: player → user message to OpenRouter (string passed as user role content)",
      userContent,
    );

    let payload: ExplanationPayload;
    let model: string;
    try {
      ({ payload, model } = await requestExplanationPayload(
        SYSTEM_PLAYER,
        userContent,
      ));
    } catch (e: any) {
      if (
        e?.message === "OPENROUTER_API_KEY environment variable is not set."
      ) {
        return res.status(503).json({
          message: "AI explanation is not configured on the server",
          data: null,
          errors: null,
        });
      }
      return res.status(502).json({
        message:
          e?.statusCode === 502
            ? e.message
            : "Failed to generate AI explanation",
        data: null,
        errors: null,
      });
    }

    const cacheDoc = buildCacheEntry(payload, model);

    await HistoryPlayerResult.updateOne(
      { _id: playerResult._id },
      {
        $set: {
          "answers.$[elem].aiExplanation": cacheDoc,
        },
      },
      {
        arrayFilters: [{ "elem.questionIndex": questionIndex }],
      },
    );

    logExplain("explain: player done — persisted answers[].aiExplanation", {
      questionIndex,
      model,
    });

    return res.status(200).json({
      message: "AI explanation generated successfully",
      data: {
        explanation: {
          payload,
          model,
          createdAt: cacheDoc.createdAt,
          schemaVersion: cacheDoc.schemaVersion,
        },
        cached: false,
      },
      errors: null,
    });
  } catch (error) {
    logExplain("explain: handler threw", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
    });
    return handleControllerError(res, error);
  }
};
