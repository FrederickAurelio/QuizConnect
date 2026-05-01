import { parseJsonWithOptionalFence } from "../history/shared.js";
import { runWithConcurrency } from "./concurrency.js";
import {
  computeFinalizeBatchPlan,
  MAX_FINALIZE_CANDIDATES_PER_CALL,
  splitIntoConsecutiveBatches,
} from "./finalize-planning.js";
import {
  FINALIZE_METADATA_JSON_SHAPE,
  FINALIZE_METADATA_SYSTEM_PROMPT,
  FINALIZE_QUESTIONS_JSON_SHAPE,
  FINALIZE_QUESTIONS_SYSTEM_PROMPT,
  buildFinalizeMetadataUserPrompt,
  buildFinalizeQuestionsUserPrompt,
} from "./prompts.js";
import type { ChunkLlmOutput, FinalizeLlmOutput } from "./schemas.js";
import {
  buildFinalizeQuestionsOutputSchema,
  finalizeMetadataOutputSchema,
} from "./schemas.js";
import {
  completeChatJson,
  OPENROUTER_MODEL,
} from "../../utils/openrouter.js";
import { logAiQuizGeneration } from "../../utils/ai-quiz-generation-log.js";

function quizGenModel(): string {
  return process.env.OPENROUTER_QUIZ_GEN_MODEL?.trim() || OPENROUTER_MODEL;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withInfraRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
): Promise<T> {
  let lastErr: unknown;
  for (let a = 0; a < maxAttempts; a++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (a < maxAttempts - 1) {
        await sleep(400 * 2 ** a);
      }
    }
  }
  throw lastErr;
}

const FINALIZE_CONCURRENCY = Math.min(
  10,
  Math.max(
    1,
    Math.floor(Number(process.env.AI_QUIZ_FINALIZE_CONCURRENCY ?? 5)) || 5,
  ),
);

const MAX_FILL_ROUNDS = 12;

/** How many finalized question stems to send into the metadata LLM (cost vs coverage). */
const METADATA_SUMMARY_QUESTIONS = 25;
const METADATA_STEM_PREVIEW = 220;

/** Normalize stems for duplicate detection across batches */
function normalizeQuestionStem(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]|_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeQuestionsByStem(
  questions: ChunkLlmOutput["questions"],
): ChunkLlmOutput["questions"] {
  const seen = new Set<string>();
  const out: ChunkLlmOutput["questions"] = [];
  for (const q of questions) {
    const k = normalizeQuestionStem(q.question);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(q);
  }
  return out;
}

function stemsOf(questions: ChunkLlmOutput["questions"]): Set<string> {
  return new Set(
    questions.map((q) => normalizeQuestionStem(q.question)).filter(Boolean),
  );
}

function filterCandidatesNotInStems(
  pool: ChunkLlmOutput["questions"],
  taken: Set<string>,
): ChunkLlmOutput["questions"] {
  return pool.filter((c) => !taken.has(normalizeQuestionStem(c.question)));
}

function trimToCount(
  questions: ChunkLlmOutput["questions"],
  count: number,
): ChunkLlmOutput["questions"] {
  if (questions.length <= count) return questions;
  return questions.slice(0, count);
}

type QuestionFinalizeBatchResult = {
  status: "DONE" | "FAILED";
  questions: ChunkLlmOutput["questions"];
  model: string;
  attemptCount: number;
  skipOrFailReason?: string;
};

async function runFinalizeQuestionBatchLlm(params: {
  candidates: ChunkLlmOutput["questions"];
  targetCount: number;
  language: string;
  difficulty: string;
  extraRules: string;
}): Promise<QuestionFinalizeBatchResult> {
  const model = quizGenModel();
  if (params.targetCount === 0) {
    return { status: "DONE", questions: [], model, attemptCount: 0 };
  }
  if (params.candidates.length === 0) {
    return {
      status: "FAILED",
      questions: [],
      model,
      attemptCount: 0,
      skipOrFailReason: "No candidates for batch",
    };
  }

  const target = Math.min(params.targetCount, params.candidates.length);
  const schema = buildFinalizeQuestionsOutputSchema(target);
  const candidateJson = JSON.stringify({ questions: params.candidates });
  const userContent = buildFinalizeQuestionsUserPrompt({
    batchTargetCount: target,
    language: params.language,
    difficulty: params.difficulty,
    extraRules: params.extraRules,
    candidateJson,
  });

  let attemptCount = 0;
  const callOnce = async (
    messages: Parameters<typeof completeChatJson>[0]["messages"],
  ) => {
    attemptCount++;
    return withInfraRetry(() => completeChatJson({ model, messages }), 3);
  };

  try {
    let { content } = await callOnce([
      { role: "system", content: FINALIZE_QUESTIONS_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ]);

    let parsed = parseJsonWithOptionalFence(content, schema);
    if (!parsed) {
      ({ content } = await callOnce([
        { role: "system", content: FINALIZE_QUESTIONS_SYSTEM_PROMPT },
        { role: "user", content: userContent },
        { role: "assistant", content },
        {
          role: "user",
          content:
            "Your previous output was invalid. Reply with exactly one JSON object matching: " +
            FINALIZE_QUESTIONS_JSON_SHAPE +
            `. The questions array MUST have length exactly ${target}.`,
        },
      ]));
      parsed = parseJsonWithOptionalFence(content, schema);
    }

    if (!parsed) {
      return {
        status: "FAILED",
        questions: [],
        model,
        attemptCount,
        skipOrFailReason: "Invalid JSON or schema after repair",
      };
    }

    return {
      status: "DONE",
      questions: parsed.questions,
      model,
      attemptCount,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: "FAILED",
      questions: [],
      model,
      attemptCount,
      skipOrFailReason: msg,
    };
  }
}

function buildQuestionSummariesForMetadata(
  questions: ChunkLlmOutput["questions"],
): string {
  const slice = questions.slice(0, METADATA_SUMMARY_QUESTIONS);
  const rows = slice.map((q) => ({
    question: q.question.trim().slice(0, METADATA_STEM_PREVIEW),
    difficulty: q.difficulty ?? undefined,
    tags: q.tags?.length ? q.tags.slice(0, 6) : undefined,
  }));
  return JSON.stringify(rows);
}

function fallbackFinalizeMetadata(params: {
  language: string;
  difficulty: string;
  questionCount: number;
  firstStem?: string;
}): { title: string; description: string } {
  const stem = params.firstStem?.trim().slice(0, 90) ?? "";
  const titleBase =
    stem.length > 0
      ? `${params.language} Quiz — ${stem}${params.firstStem && params.firstStem.length > 90 ? "…" : ""}`
      : `${params.language} Quiz (${params.difficulty})`;
  const title =
    titleBase.length <= 200 ? titleBase : titleBase.slice(0, 197) + "…";
  const description = `A ${params.difficulty}-level multiple-choice quiz with ${params.questionCount} questions (${params.language}).`;
  return { title: title.trim(), description };
}

async function runFinalizeMetadataLlmOnce(params: {
  language: string;
  difficulty: string;
  extraRules: string;
  questions: ChunkLlmOutput["questions"];
  model: string;
}): Promise<{
  output: { title: string; description: string };
  attemptCount: number;
} | null> {
  let attemptCount = 0;
  const callOnce = async (
    messages: Parameters<typeof completeChatJson>[0]["messages"],
  ) => {
    attemptCount++;
    return withInfraRetry(() => completeChatJson({ model: params.model, messages }), 3);
  };

  const summaryJson = buildQuestionSummariesForMetadata(params.questions);
  const userContent = buildFinalizeMetadataUserPrompt({
    language: params.language,
    difficulty: params.difficulty,
    extraRules: params.extraRules,
    questionSummaryJson: summaryJson,
  });

  let { content } = await callOnce([
    { role: "system", content: FINALIZE_METADATA_SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ]);

  let parsed = parseJsonWithOptionalFence(content, finalizeMetadataOutputSchema);
  if (!parsed) {
    ({ content } = await callOnce([
      { role: "system", content: FINALIZE_METADATA_SYSTEM_PROMPT },
      { role: "user", content: userContent },
      { role: "assistant", content },
      {
        role: "user",
        content:
          "Your previous output was invalid. Reply with exactly one JSON object matching " +
          FINALIZE_METADATA_JSON_SHAPE +
          ".",
      },
    ]));
    parsed = parseJsonWithOptionalFence(content, finalizeMetadataOutputSchema);
  }

  if (!parsed) return null;
  return { output: parsed, attemptCount };
}

async function resolveMetadata(params: {
  language: string;
  difficulty: string;
  extraRules: string;
  questions: ChunkLlmOutput["questions"];
  preferredModel: string;
}): Promise<{ title: string; description: string }> {
  const fb = fallbackFinalizeMetadata({
    language: params.language,
    difficulty: params.difficulty,
    questionCount: params.questions.length,
    ...(params.questions[0]?.question
      ? { firstStem: params.questions[0]!.question }
      : {}),
  });

  logAiQuizGeneration("finalize: metadata OpenRouter starting", {
    model: params.preferredModel,
    stemsInSummary: Math.min(params.questions.length, METADATA_SUMMARY_QUESTIONS),
  });

  try {
    const parsed = await runFinalizeMetadataLlmOnce({
      language: params.language,
      difficulty: params.difficulty,
      extraRules: params.extraRules,
      questions: params.questions,
      model: params.preferredModel,
    });
    if (parsed?.output.title?.trim()) {
      logAiQuizGeneration("finalize: metadata llm ok", {
        titleLength: parsed.output.title.length,
      });
      return {
        title: parsed.output.title.trim(),
        description: (parsed.output.description ?? "").trim(),
      };
    }
    logAiQuizGeneration("finalize: metadata parse failed or empty title, fallback", {});
  } catch (e) {
    logAiQuizGeneration("finalize: metadata llm threw", {
      message: e instanceof Error ? e.message : String(e),
    });
  }

  logAiQuizGeneration("finalize: metadata using deterministic fallback", {});
  return fb;
}

/**
 * Split finalize: bounded candidate batches, concurrent question LLM calls, then one metadata call.
 * Public contract unchanged for the orchestrator.
 */
export async function runFinalizeLlm(params: {
  questionCount: number;
  language: string;
  difficulty: string;
  extraRules: string;
  candidates: ChunkLlmOutput["questions"];
}): Promise<{ output: FinalizeLlmOutput; model: string }> {
  try {
    return await runFinalizeLlmInner(params);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logAiQuizGeneration("finalize: thrown before completion", {
      message,
      name: e instanceof Error ? e.name : "unknown",
    });
    throw e;
  }
}

async function runFinalizeLlmInner(params: {
  questionCount: number;
  language: string;
  difficulty: string;
  extraRules: string;
  candidates: ChunkLlmOutput["questions"];
}): Promise<{ output: FinalizeLlmOutput; model: string }> {
  const model = quizGenModel();
  const N = params.candidates.length;
  const T = Math.min(params.questionCount, N);

  if (T === 0) {
    const err = new Error("No candidate questions to finalize.");
    (err as { statusCode?: number }).statusCode = 502;
    throw err;
  }

  const plan = computeFinalizeBatchPlan({
    candidateCount: N,
    finalQuestionCount: T,
    maxCandidatesPerBatch: MAX_FINALIZE_CANDIDATES_PER_CALL,
  });

  logAiQuizGeneration("finalize: batch plan", {
    candidates: N,
    target: T,
    batchCount: plan.groupSizes.length,
    groupSizes: plan.groupSizes,
    targets: plan.targets,
    concurrency: FINALIZE_CONCURRENCY,
  });

  const batches = splitIntoConsecutiveBatches(
    params.candidates,
    plan.groupSizes,
  );

  type BatchTask = {
    candidates: ChunkLlmOutput["questions"];
    targetCount: number;
    index: number;
  };

  const tasks: BatchTask[] = batches.map((cands, i) => ({
    candidates: cands,
    targetCount: Math.min(plan.targets[i]!, cands.length),
    index: i,
  }));

  logAiQuizGeneration("finalize: question batches calling OpenRouter", {
    model,
    parallelBatchCount: tasks.length,
  });

  const parallelResults = await runWithConcurrency(
    tasks,
    FINALIZE_CONCURRENCY,
    async (task) => {
      logAiQuizGeneration("finalize: OpenRouter question batch START", {
        taskIndex: task.index,
        targetCount: task.targetCount,
        candidateCount: task.candidates.length,
        model,
      });
      const res = await runFinalizeQuestionBatchLlm({
        candidates: task.candidates,
        targetCount: task.targetCount,
        language: params.language,
        difficulty: params.difficulty,
        extraRules: params.extraRules,
      });
      logAiQuizGeneration("finalize: OpenRouter question batch END", {
        taskIndex: task.index,
        status: res.status,
        returnedQuestionCount: res.questions.length,
        chatAttempts: res.attemptCount,
        ...(res.skipOrFailReason
          ? { skipOrFailReason: res.skipOrFailReason }
          : {}),
      });
      return { taskIndex: task.index, res };
    },
  );

  parallelResults.sort((a, b) => a.taskIndex - b.taskIndex);

  let mergedForLog = 0;
  for (const { res } of parallelResults) {
    if (res.status === "DONE") mergedForLog += res.questions.length;
  }
  const failedBatches = parallelResults.filter((r) => r.res.status !== "DONE").length;
  logAiQuizGeneration("finalize: parallel batches done", {
    batchCount: parallelResults.length,
    failedOrEmptyBatches: failedBatches,
    mergedRawQuestionCount: mergedForLog,
  });

  let merged: ChunkLlmOutput["questions"] = [];
  for (const { res } of parallelResults) {
    if (res.status === "DONE") {
      merged.push(...res.questions);
    }
  }

  merged = dedupeQuestionsByStem(merged);
  merged = trimToCount(merged, T);

  logAiQuizGeneration("finalize: after dedupe trim", {
    target: T,
    mergedCount: merged.length,
    deficit: T - merged.length,
  });

  let deficit = T - merged.length;
  let fillRound = 0;
  while (deficit > 0 && fillRound < MAX_FILL_ROUNDS) {
    fillRound++;
    const taken = stemsOf(merged);
    const pool = filterCandidatesNotInStems(params.candidates, taken);
    if (pool.length === 0) {
      logAiQuizGeneration("finalize: fill stopped, no pool left", {
        round: fillRound,
        deficit,
      });
      break;
    }

    const batch = pool.slice(0, MAX_FINALIZE_CANDIDATES_PER_CALL);
    const want = Math.min(deficit, batch.length);

    logAiQuizGeneration("finalize: fill round OpenRouter START", {
      round: fillRound,
      want,
      poolHeadCount: batch.length,
      model,
    });

    const fillRes = await runFinalizeQuestionBatchLlm({
      candidates: batch,
      targetCount: want,
      language: params.language,
      difficulty: params.difficulty,
      extraRules: params.extraRules,
    });

    if (fillRes.status !== "DONE" || fillRes.questions.length === 0) {
      logAiQuizGeneration("finalize: fill round no usable output", {
        round: fillRound,
        status: fillRes.status,
        skipOrFailReason: fillRes.skipOrFailReason,
      });
      continue;
    }

    merged.push(...fillRes.questions);
    merged = dedupeQuestionsByStem(merged);
    merged = trimToCount(merged, T);
    deficit = T - merged.length;

    logAiQuizGeneration("finalize: fill round applied", {
      round: fillRound,
      mergedCount: merged.length,
      deficitRemaining: deficit,
    });
  }

  if (merged.length < T) {
    const err = new Error(
      `Finalize produced only ${merged.length} of ${T} required questions after batching and fill.`,
    );
    (err as { statusCode?: number }).statusCode = 502;
    throw err;
  }

  logAiQuizGeneration("finalize: merged questions, metadata next", {
    mergedCount: merged.length,
    target: T,
  });

  const meta = await resolveMetadata({
    language: params.language,
    difficulty: params.difficulty,
    extraRules: params.extraRules,
    questions: merged,
    preferredModel: model,
  });

  const output: FinalizeLlmOutput = {
    title: meta.title,
    description: meta.description,
    questions: merged,
  };

  logAiQuizGeneration("finalize: complete", {
    questionCount: merged.length,
    titleLength: meta.title.length,
  });

  return { output, model };
}
