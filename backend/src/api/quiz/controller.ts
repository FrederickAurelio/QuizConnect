import { Request, Response } from "express";
import z from "zod";
import Quiz from "../../models/Quiz.js";
import QuizDraft from "../../models/QuizDraft.js";
import { handleControllerError } from "../../utils/handle-control-error.js";
import { Types } from "mongoose";
import { redis } from "../../redis/index.js";

const optionSchema = z.object({
  key: z.enum(["A", "B", "C", "D"]),
  text: z.string().trim(),
});

export const questionSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  question: z.string().trim(),
  options: z
    .array(optionSchema)
    .length(4, "Each question needs exactly 4 options"),
  correctKey: z.enum(["A", "B", "C", "D", ""]).optional(),
  done: z.boolean(),
});

const quizSchema = z.object({
  title: z.string().min(1, "Title is required even for drafts").max(100),
  description: z.string().max(500).optional(),
  questions: z.array(questionSchema),
  draft: z.boolean().default(false),
});

async function hasActiveLobbyForQuiz(
  userId: string,
  quizId: string,
): Promise<boolean> {
  const activeLobbyKey = `activeHostLobby:${userId}:${quizId}`;
  const existingGameCode = await redis.get(activeLobbyKey);
  if (!existingGameCode) return false;
  const lobbyExists = await redis.get(`game:${existingGameCode}`);
  return !!lobbyExists;
}

function buildDetailPayload(
  quiz: {
    _id: Types.ObjectId;
    title: string;
    description: string;
    questions: unknown[];
    creatorId: Types.ObjectId;
    draft: boolean;
    hasQuizDraft?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  },
  overrides?: { title: string; description: string; questions: unknown[] },
) {
  const base = {
    _id: quiz._id,
    creatorId: quiz.creatorId,
    title: overrides?.title ?? quiz.title,
    description: overrides?.description ?? quiz.description,
    questions: overrides?.questions ?? quiz.questions,
    draft: overrides ? true : quiz.draft,
    hasQuizDraft: quiz.hasQuizDraft ?? false,
    revertable: quiz.draft === false,
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt,
  };
  return base;
}

// ---------------- CREATE ----------------
export const createQuiz = async (req: Request, res: Response) => {
  try {
    const parsedData = quizSchema.parse(req.body);
    const creatorId = req.session.userId;

    if (!creatorId) {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }

    const newQuiz = new Quiz({
      ...parsedData,
      creatorId: creatorId,
      hasQuizDraft: false,
    });

    await newQuiz.save();

    return res.status(201).json({
      message: parsedData.draft
        ? "Draft saved successfully"
        : "Quiz created successfully!",
      data: newQuiz,
      errors: null,
    });
  } catch (error: any) {
    return handleControllerError(res, error);
  }
};

// ---------------- UPDATE ----------------
export const updateQuiz = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsedData = quizSchema.parse(req.body);
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }

    const quiz = await Quiz.findOne({
      _id: new Types.ObjectId(id),
      creatorId: new Types.ObjectId(userId),
    });

    if (!quiz) {
      return res.status(404).json({
        message: "Quiz not found or access denied",
        data: null,
        errors: null,
      });
    }

    const lobbyActive = await hasActiveLobbyForQuiz(String(userId), String(id));

    if (lobbyActive) {
      if (parsedData.draft === false) {
        return res.status(403).json({
          message:
            "A game session is active. You can save as draft, but cannot publish until the session ends.",
          data: null,
          errors: null,
        });
      }
    }

    if (parsedData.draft === true) {
      if (quiz.draft === true) {
        quiz.set({
          title: parsedData.title,
          description: parsedData.description || "",
          questions: parsedData.questions,
          draft: true,
        });
        await quiz.save();
      } else {
        await QuizDraft.findOneAndUpdate(
          { quizId: new Types.ObjectId(id) },
          {
            quizId: new Types.ObjectId(id),
            title: parsedData.title,
            description: parsedData.description || "",
            questions: parsedData.questions,
            creatorId: new Types.ObjectId(userId),
          },
          { upsert: true, new: true },
        );
        await Quiz.updateOne(
          { _id: new Types.ObjectId(id) },
          { hasQuizDraft: true },
        );
        quiz.hasQuizDraft = true;
      }
    } else {
      quiz.set({
        title: parsedData.title,
        description: parsedData.description || "",
        questions: parsedData.questions,
        draft: false,
        hasQuizDraft: false,
      });
      await quiz.save();
      await QuizDraft.deleteOne({ quizId: new Types.ObjectId(id) });
    }

    const fresh = await Quiz.findById(id);
    return res.status(200).json({
      message: "Quiz updated success",
      data: fresh,
      errors: null,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ---------------- DELETE ----------------
export const deleteQuiz = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }

    const activeLobbyKey = `activeHostLobby:${userId}:${id}`;
    const existingGameCode = await redis.get(activeLobbyKey);
    if (existingGameCode) {
      const lobbyExists = await redis.get(`game:${existingGameCode}`);
      if (lobbyExists) {
        return res.status(403).json({
          message: `Cannot modify or delete this quiz because a game is currently running (Code: ${existingGameCode}). Please end the session before making changes.`,
          data: null,
          errors: null,
        });
      }
    }

    const result = await Quiz.deleteOne({ _id: id, creatorId: userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        message: "Quiz not found or access denied",
        data: null,
        errors: null,
      });
    }

    await QuizDraft.deleteOne({ quizId: new Types.ObjectId(id) });

    return res.status(200).json({
      message: "Quiz deleted successfully",
      data: null,
      errors: null,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ---------------- COPY ----------------
export const copyQuiz = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }

    const quiz = await Quiz.findOne({
      _id: new Types.ObjectId(id),
      creatorId: new Types.ObjectId(userId),
    });

    if (!quiz) {
      return res.status(404).json({
        message: "Quiz not found or access denied",
        data: null,
        errors: null,
      });
    }

    const useDraft = req.query.useDraft === "true";

    let title = quiz.title;
    let description = quiz.description;
    let questions = quiz.questions;
    let draftFlag = quiz.draft;

    if (useDraft && quiz.hasQuizDraft) {
      const draftDoc = await QuizDraft.findOne({
        quizId: new Types.ObjectId(id),
      }).lean();
      if (draftDoc) {
        title = draftDoc.title;
        description = draftDoc.description;
        questions = draftDoc.questions as typeof quiz.questions;
        draftFlag = true;
      }
    }

    const newQuiz = new Quiz({
      title: `${title}-Copy`,
      description,
      questions,
      draft: draftFlag,
      hasQuizDraft: false,
      creatorId: userId,
    });

    await newQuiz.save();

    return res.status(201).json({
      message: "Quiz copied successfully",
      data: newQuiz,
      errors: null,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ---------------- GET QUIZZES WITH PAGINATION (Aggregation) ----------------
export const getQuizzes = async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }

    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.max(Number(req.query.pageSize) || 10, 1);
    const skip = (page - 1) * pageSize;
    const draftOnly = req.query.draftOnly === "true";
    const readyOnly = req.query.readyOnly === "true";

    const filter: Record<string, unknown> = {
      creatorId: new Types.ObjectId(userId),
    };
    if (draftOnly) {
      filter.$or = [{ draft: true }, { hasQuizDraft: true }];
    }
    if (readyOnly) filter.draft = false;

    const total = await Quiz.countDocuments(filter);

    const draftColl = QuizDraft.collection.collectionName;

    const listAfterPage = draftOnly
      ? [
          {
            $lookup: {
              from: draftColl,
              let: { qid: "$_id", uid: "$creatorId" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$quizId", "$$qid"] },
                        { $eq: ["$creatorId", "$$uid"] },
                      ],
                    },
                  },
                },
                { $limit: 1 },
              ],
              as: "draftRows",
            },
          },
          {
            $addFields: {
              _fromDraft: {
                $and: [
                  "$hasQuizDraft",
                  { $gt: [{ $size: "$draftRows" }, 0] },
                ],
              },
            },
          },
          {
            $project: {
              title: {
                $cond: [
                  "$_fromDraft",
                  { $arrayElemAt: ["$draftRows.title", 0] },
                  "$title",
                ],
              },
              description: {
                $cond: [
                  "$_fromDraft",
                  { $arrayElemAt: ["$draftRows.description", 0] },
                  "$description",
                ],
              },
              draft: { $cond: ["$_fromDraft", true, "$draft"] },
              // Explicit boolean so clients always see WIP (hasQuizDraft: 1 alone can omit/mis-resolve in some pipelines)
              hasQuizDraft: {
                $cond: [
                  "$_fromDraft",
                  true,
                  { $ifNull: ["$hasQuizDraft", false] },
                ],
              },
              updatedAt: {
                $cond: [
                  "$_fromDraft",
                  {
                    $ifNull: [
                      { $arrayElemAt: ["$draftRows.updatedAt", 0] },
                      "$updatedAt",
                    ],
                  },
                  "$updatedAt",
                ],
              },
              questionCount: {
                $cond: [
                  "$_fromDraft",
                  {
                    $size: {
                      $ifNull: [
                        { $arrayElemAt: ["$draftRows.questions", 0] },
                        [],
                      ],
                    },
                  },
                  { $size: "$questions" },
                ],
              },
            },
          },
        ]
      : [
          {
            $project: {
              title: 1,
              description: 1,
              draft: 1,
              hasQuizDraft: 1,
              updatedAt: 1,
              questionCount: { $size: "$questions" },
            },
          },
        ];

    const quizzes = await Quiz.aggregate([
      { $match: filter },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: pageSize },
      ...listAfterPage,
    ]);

    const hasNext = page * pageSize < total;

    return res.status(200).json({
      message: "Quizzes fetched successfully",
      data: {
        total,
        page,
        pageSize,
        hasNext,
        data: quizzes,
      },
      errors: null,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ---------------- GET QUIZ DETAIL ----------------
export const getDetailQuiz = async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }

    const quizId = req.params.id;
    if (!quizId) {
      return res.status(404).json({
        message: "Quiz not found",
        data: null,
        errors: null,
      });
    }

    const quiz = await Quiz.findOne({
      _id: new Types.ObjectId(quizId),
      creatorId: new Types.ObjectId(userId),
    });

    if (!quiz) {
      return res.status(404).json({
        message: "Quiz not found",
        data: null,
        errors: null,
      });
    }

    const qObj = quiz.toObject();

    if (quiz.hasQuizDraft) {
      const draftDoc = await QuizDraft.findOne({
        quizId: new Types.ObjectId(quizId),
      }).lean();

      if (draftDoc) {
        const payload = buildDetailPayload(qObj as any, {
          title: draftDoc.title,
          description: draftDoc.description,
          questions: draftDoc.questions as unknown[],
        });
        return res.status(200).json({
          message: "Quiz fetched successfully",
          data: payload,
          errors: null,
        });
      }
      await Quiz.updateOne(
        { _id: new Types.ObjectId(quizId) },
        { hasQuizDraft: false },
      );
      qObj.hasQuizDraft = false;
    }

    const payload = buildDetailPayload(qObj as any);
    return res.status(200).json({
      message: "Quiz fetched successfully",
      data: payload,
      errors: null,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

// ---------------- REVERT DRAFT (delete WIP, return published Quiz) ----------------
export const revertDraft = async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }

    const quizId = req.params.id;
    if (!quizId) {
      return res.status(404).json({
        message: "Quiz not found",
        data: null,
        errors: null,
      });
    }

    const quiz = await Quiz.findOne({
      _id: new Types.ObjectId(quizId),
      creatorId: new Types.ObjectId(userId),
    });

    if (!quiz) {
      return res.status(404).json({
        message: "Quiz not found",
        data: null,
        errors: null,
      });
    }

    if (quiz.draft === true) {
      return res.status(400).json({
        message:
          "Only published quizzes can be reverted to the published version.",
        data: null,
        errors: null,
      });
    }

    await QuizDraft.deleteOne({ quizId: new Types.ObjectId(quizId) });
    await Quiz.updateOne(
      { _id: new Types.ObjectId(quizId) },
      { hasQuizDraft: false },
    );

    quiz.hasQuizDraft = false;
    const qObj = quiz.toObject();
    const payload = buildDetailPayload(qObj as any);

    return res.status(200).json({
      message: "Reverted to published version",
      data: payload,
      errors: null,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};
