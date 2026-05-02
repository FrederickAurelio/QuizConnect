import { Types } from "mongoose";
import { randomUUID } from "crypto";
import AiQuizGenerationRecord from "../../models/AiQuizGenerationRecord.js";
import AiPreparedMaterial from "../../models/AiPreparedMaterial.js";
import Quiz from "../../models/Quiz.js";
import { runChunkLlm } from "./chunk-runner.js";
import { runFinalizeLlm } from "./finalizer.js";
import { releaseGenerationLock } from "./lock.js";
import type { ChunkLlmOutput, CreateGenerationBody } from "./schemas.js";

const CHUNK_CONCURRENCY = Math.min(
  10,
  Math.max(
    1,
    Math.floor(Number(process.env.AI_QUIZ_CHUNK_CONCURRENCY ?? 5)) || 5,
  ),
);

/** Succeed with a partial quiz if we have at least this many candidates to build a quiz. */
const MIN_CANDIDATES_TO_FINALIZE = 1;

type FlatChunk = {
  globalChunkIndex: number;
  materialId: Types.ObjectId;
  materialChunkIndex: number;
  text: string;
};

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]!, i);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function deletePreparedMaterialsForJob(params: {
  userId: Types.ObjectId;
  preparedFileIds: Types.ObjectId[];
}): Promise<void> {
  if (!params.preparedFileIds.length) return;
  await AiPreparedMaterial.deleteMany({
    userId: params.userId,
    _id: { $in: params.preparedFileIds },
  });
}

export async function runAiQuizGenerationJob(
  generationIdStr: string,
): Promise<void> {
  if (!Types.ObjectId.isValid(generationIdStr)) {
    console.warn("runAiQuizGenerationJob: invalid generation id", generationIdStr);
    return;
  }

  const generationId = new Types.ObjectId(generationIdStr);
  const record = await AiQuizGenerationRecord.findById(generationId);
  if (!record || record.status !== "PROCESSING") {
    return;
  }

  const userId = record.userId as Types.ObjectId;
  const preparedIds = record.preparedFileIds as Types.ObjectId[];
  const userIdStr = String(userId);

  const markFailed = async (stage: string, message: string) => {
    record.status = "FAILED";
    record.progress.stage = "failed";
    record.error = { stage, message };
    await record.save();
  };

  try {
    record.progress.stage = "load_materials";
    await record.save();

    const materials = await AiPreparedMaterial.find({
      _id: { $in: preparedIds },
      userId,
    }).lean();

    if (materials.length !== preparedIds.length) {
      await markFailed(
        "load_materials",
        "One or more prepared materials were not found or access denied.",
      );
      return;
    }

    const orderMap = new Map(
      preparedIds.map((id, idx) => [String(id), idx] as const),
    );
    materials.sort(
      (a, b) =>
        (orderMap.get(String(a._id)) ?? 0) - (orderMap.get(String(b._id)) ?? 0),
    );

    const flatChunks: FlatChunk[] = [];
    let globalIdx = 0;
    for (const m of materials) {
      const cleanTexts = m.cleanTexts as string[];
      const mid = m._id as Types.ObjectId;
      for (let i = 0; i < cleanTexts.length; i++) {
        flatChunks.push({
          globalChunkIndex: globalIdx++,
          materialId: mid,
          materialChunkIndex: i,
          text: cleanTexts[i]!,
        });
      }
    }

    if (flatChunks.length === 0) {
      await markFailed("load_materials", "No text chunks found in prepared materials.");
      return;
    }

    const questionCount = record.settings.questionCount;
    const chunkTotal = flatChunks.length;
    const perChunkMax = Math.ceil(questionCount / chunkTotal);

    record.progress.chunkTotal = chunkTotal;
    record.progress.chunkDone = 0;
    record.progress.chunkFailed = 0;
    record.progress.chunkSkipped = 0;
    record.progress.stage = "chunk_generation";
    await record.save();

    const styleRules = record.promptText;

    const language =
      record.settings.language as CreateGenerationBody["settings"]["language"];

    const chunkOutputs = await runWithConcurrency(
      flatChunks,
      CHUNK_CONCURRENCY,
      async (fc) =>
        runChunkLlm({
          perChunkMax,
          language,
          difficulty: record.settings.difficulty,
          styleRules,
          chunkIndex: fc.globalChunkIndex,
          totalChunks: chunkTotal,
          chunkText: fc.text,
        }),
    );

    record.set(
      "chunks",
      flatChunks.map((fc, i) => {
        const res = chunkOutputs[i]!;
        const status =
          res.status === "DONE"
            ? "DONE"
            : res.status === "SKIPPED"
              ? "SKIPPED"
              : "FAILED";
        return {
          globalChunkIndex: fc.globalChunkIndex,
          materialId: fc.materialId,
          materialChunkIndex: fc.materialChunkIndex,
          status: status as "DONE" | "SKIPPED" | "FAILED",
          candidateCount: res.status === "DONE" ? res.questions.length : 0,
          attemptCount: res.attemptCount,
          ...(res.skipOrFailReason
            ? { errorMessage: res.skipOrFailReason }
            : {}),
        };
      }),
    );

    let done = 0;
    let failed = 0;
    let skipped = 0;
    for (const res of chunkOutputs) {
      if (res.status === "DONE") done++;
      else if (res.status === "FAILED") failed++;
      else skipped++;
    }
    record.progress.chunkDone = done;
    record.progress.chunkFailed = failed;
    record.progress.chunkSkipped = skipped;
    await record.save();

    const candidates: ChunkLlmOutput["questions"] = [];
    for (const res of chunkOutputs) {
      if (res.status === "DONE") {
        for (const q of res.questions) {
          candidates.push(q);
        }
      }
      if (!record.get("model") && res.model) {
        record.set("model", res.model);
      }
    }

    if (candidates.length < MIN_CANDIDATES_TO_FINALIZE) {
      await markFailed(
        "chunk_generation",
        `Not enough candidate questions (${candidates.length}); need at least ${MIN_CANDIDATES_TO_FINALIZE} to build a quiz.`,
      );
      return;
    }

    const finalQuestionCount = Math.min(questionCount, candidates.length);

    record.progress.stage = "finalize";
    await record.save();

    const { output: finalized, model: finalModel } = await runFinalizeLlm({
      questionCount: finalQuestionCount,
      language,
      difficulty: record.settings.difficulty,
      extraRules: record.promptText,
      candidates,
    });
    record.set(
      "model",
      finalModel || (record.get("model") as string | undefined) || "",
    );

    record.progress.stage = "persist_quiz";
    await record.save();

    const quizQuestions = finalized.questions.map((q) => ({
      id: randomUUID(),
      question: q.question.trim(),
      options: q.options.map((o) => ({
        key: o.key,
        text: o.text.trim(),
      })),
      correctKey: q.correctKey,
      done: false,
    }));

    const newQuiz = new Quiz({
      title: finalized.title.trim(),
      description: (finalized.description ?? "").trim(),
      questions: quizQuestions,
      draft: true,
      creatorId: userId,
      hasQuizDraft: false,
    });
    await newQuiz.save();

    record.status = "DONE";
    record.progress.stage = "done";
    record.output = {
      quizId: newQuiz._id as Types.ObjectId,
      quizTitle: newQuiz.title,
      quizDescription: newQuiz.description,
      questionCount: quizQuestions.length,
    };
    record.set("error", null);
    await record.save();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const stage = record.progress?.stage ?? "unknown";
    await markFailed(
      stage === "done" || stage === "failed" ? "unknown" : stage,
      message,
    );
  } finally {
    await releaseGenerationLock(userIdStr, generationIdStr);
    await deletePreparedMaterialsForJob({
      userId,
      preparedFileIds: preparedIds,
    });
  }
}
