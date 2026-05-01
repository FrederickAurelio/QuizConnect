import type { Request, Response } from "express";
import { Types } from "mongoose";
import {
  createGenerationBodySchema,
  validatePreparedChunksBodySchema,
} from "./schemas.js";
import {
  MAX_PREPARED_CHUNKS_PER_GENERATION,
  sumPreparedChunksForGeneration,
} from "./prepared-chunk-budget.js";
import AiQuizGenerationRecord from "../../models/AiQuizGenerationRecord.js";
import { handleControllerError } from "../../utils/handle-control-error.js";
import {
  acquireGenerationLock,
  generationLockKey,
  releaseGenerationLock,
} from "./lock.js";
import { enqueueAiQuizGeneration } from "../../queues/ai-quiz-generation-queue.js";

function isMongoDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}

/** Plain or hydrated doc shape for API mapping (supports `.lean()` results). */
export type GenerationRecordLike = {
  _id: Types.ObjectId;
  preparedFileIds: Types.ObjectId[];
  status: "PROCESSING" | "DONE" | "FAILED";
  promptText: string;
  settings: {
    questionCount: number;
    difficulty: "easy" | "medium" | "hard";
    language: string;
  };
  model?: string | undefined;
  createdAt?: Date | undefined;
  updatedAt?: Date | undefined;
  output?: {
    quizId?: Types.ObjectId | undefined;
    quizTitle?: string | undefined;
    quizDescription?: string | undefined;
    questionCount?: number | undefined;
  };
  error?: {
    stage?: string | undefined;
    message?: string | undefined;
  };
};

export function toClientGeneration(doc: GenerationRecordLike) {
  return {
    generationId: String(doc._id),
    preparedFileIds: (doc.preparedFileIds as Types.ObjectId[]).map(String),
    status: doc.status as "PROCESSING" | "DONE" | "FAILED",
    promptText: doc.promptText,
    settings: {
      questionCount: doc.settings.questionCount,
      difficulty: doc.settings.difficulty,
      language: doc.settings.language,
    },
    model: doc.model || "",
    createdAt: (doc.createdAt ?? new Date()).toISOString(),
    updatedAt: (doc.updatedAt ?? new Date()).toISOString(),
    ...(doc.output?.quizId
      ? { quizId: String(doc.output.quizId) }
      : {}),
    ...(doc.output?.quizTitle != null
      ? { quizTitle: doc.output.quizTitle }
      : {}),
    ...(doc.output?.quizDescription != null
      ? { quizDescription: doc.output.quizDescription }
      : {}),
    ...(doc.error?.message ? { errorMessage: doc.error.message } : {}),
  };
}

export const validatePreparedChunksForGeneration = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.session.userId;
    if (!userId || req.session.type !== "auth") {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }

    const body = validatePreparedChunksBodySchema.parse(req.body ?? {});
    const preparedObjectIds = body.preparedFileIds.map(
      (id) => new Types.ObjectId(id),
    );
    const userObjectId = new Types.ObjectId(String(userId));

    const chunkCheck = await sumPreparedChunksForGeneration({
      userObjectId,
      preparedObjectIds,
    });

    if (!chunkCheck.ok) {
      return res.status(400).json({
        message: chunkCheck.message,
        data: null,
        errors: null,
      });
    }

    return res.status(200).json({
      message: "OK",
      data: {
        chunkTotal: chunkCheck.chunkTotal,
        maxChunks: MAX_PREPARED_CHUNKS_PER_GENERATION,
      },
      errors: null,
    });
  } catch (error: unknown) {
    return handleControllerError(res, error);
  }
};

export const createAiQuizGeneration = async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId || req.session.type !== "auth") {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }

    const body = createGenerationBodySchema.parse(req.body ?? {});
    const preparedObjectIds = body.preparedFileIds.map(
      (id) => new Types.ObjectId(id),
    );
    const userObjectId = new Types.ObjectId(String(userId));

    const chunkCheck = await sumPreparedChunksForGeneration({
      userObjectId,
      preparedObjectIds,
    });

    if (!chunkCheck.ok) {
      return res.status(400).json({
        message: chunkCheck.message,
        data: null,
        errors: null,
      });
    }

    const active = await AiQuizGenerationRecord.findOne({
      userId: userObjectId,
      status: "PROCESSING",
    })
      .select({ _id: 1 })
      .lean();

    if (active) {
      return res.status(409).json({
        message: "You already have a quiz generation in progress.",
        data: null,
        errors: null,
      });
    }

    let record: InstanceType<typeof AiQuizGenerationRecord> | null = null;
    const userIdStr = String(userId);

    try {
      record = await AiQuizGenerationRecord.create({
        userId: userObjectId,
        preparedFileIds: preparedObjectIds,
        status: "PROCESSING",
        promptText: body.promptText,
        settings: {
          questionCount: body.settings.questionCount,
          difficulty: body.settings.difficulty,
          language: body.settings.language,
        },
        model: "",
        progress: {
          stage: "queued",
          chunkTotal: 0,
          chunkDone: 0,
          chunkFailed: 0,
          chunkSkipped: 0,
        },
        chunks: [],
        lockKey: generationLockKey(userIdStr),
      });
    } catch (e: unknown) {
      if (isMongoDuplicateKey(e)) {
        return res.status(409).json({
          message: "You already have a quiz generation in progress.",
          data: null,
          errors: null,
        });
      }
      throw e;
    }

    const generationIdStr = String(record._id);

    const lockOk = await acquireGenerationLock(userIdStr, generationIdStr);
    if (!lockOk) {
      await AiQuizGenerationRecord.findByIdAndDelete(record._id);
      return res.status(409).json({
        message: "Could not acquire generation lock. Try again shortly.",
        data: null,
        errors: null,
      });
    }

    try {
      await enqueueAiQuizGeneration(generationIdStr);
    } catch (e: unknown) {
      await AiQuizGenerationRecord.findByIdAndDelete(record._id);
      await releaseGenerationLock(userIdStr, generationIdStr);
      throw e;
    }

    return res.status(202).json({
      message: "Quiz generation started",
      data: toClientGeneration(record as GenerationRecordLike),
      errors: null,
    });
  } catch (error: unknown) {
    return handleControllerError(res, error);
  }
};

export const listAiQuizGenerations = async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId || req.session.type !== "auth") {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }

    const userObjectId = new Types.ObjectId(String(userId));
    const rows = await AiQuizGenerationRecord.find({ userId: userObjectId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({
      message: "OK",
      data: rows.map((r) => toClientGeneration(r as GenerationRecordLike)),
      errors: null,
    });
  } catch (error: unknown) {
    return handleControllerError(res, error);
  }
};

export const getAiQuizGeneration = async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId || req.session.type !== "auth") {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }

    const { generationId } = req.params;
    if (!generationId || !Types.ObjectId.isValid(generationId)) {
      return res.status(404).json({
        message: "Generation not found",
        data: null,
        errors: null,
      });
    }

    const doc = await AiQuizGenerationRecord.findOne({
      _id: new Types.ObjectId(generationId),
      userId: new Types.ObjectId(String(userId)),
    });

    if (!doc) {
      return res.status(404).json({
        message: "Generation not found",
        data: null,
        errors: null,
      });
    }

    return res.status(200).json({
      message: "OK",
      data: toClientGeneration(doc as GenerationRecordLike),
      errors: null,
    });
  } catch (error: unknown) {
    return handleControllerError(res, error);
  }
};

export const deleteAiQuizGeneration = async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId || req.session.type !== "auth") {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }

    const { generationId } = req.params;
    if (!generationId || !Types.ObjectId.isValid(generationId)) {
      return res.status(404).json({
        message: "Generation not found",
        data: null,
        errors: null,
      });
    }

    const doc = await AiQuizGenerationRecord.findOne({
      _id: new Types.ObjectId(generationId),
      userId: new Types.ObjectId(String(userId)),
    })
      .select({ _id: 1, status: 1 })
      .lean();

    if (!doc) {
      return res.status(404).json({
        message: "Generation not found",
        data: null,
        errors: null,
      });
    }

    if (doc.status === "PROCESSING") {
      return res.status(409).json({
        message: "Cannot delete a generation that is still processing.",
        data: null,
        errors: null,
      });
    }

    await AiQuizGenerationRecord.deleteOne({ _id: doc._id });

    return res.status(200).json({
      message: "Generation deleted",
      data: null,
      errors: null,
    });
  } catch (error: unknown) {
    return handleControllerError(res, error);
  }
};
