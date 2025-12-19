import { Request, Response } from "express";
import z from "zod";
import Quiz from "../../models/Quiz.js";
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

    quiz.set({
      title: parsedData.title,
      description: parsedData.description || "",
      questions: parsedData.questions,
      draft: parsedData.draft,
    });

    await quiz.save();

    return res.status(200).json({
      message: "Quiz updated success",
      data: quiz,
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

    const newQuiz = new Quiz({
      title: `${quiz?.title}-Copy`,
      description: quiz?.description,
      questions: quiz?.questions,
      draft: quiz?.draft,
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

    // Pagination params
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.max(Number(req.query.pageSize) || 10, 1);
    const skip = (page - 1) * pageSize;
    const draftOnly = req.query.draftOnly === "true"; // parse boolean
    const readyOnly = req.query.readyOnly === "true"; // parse boolean

    // Build filter
    const filter: any = { creatorId: new Types.ObjectId(userId) };
    if (draftOnly) filter.draft = true;
    if (readyOnly) filter.draft = false;

    // Count total quizzes
    const total = await Quiz.countDocuments({ creatorId: userId });

    // Aggregation pipeline
    const quizzes = await Quiz.aggregate([
      { $match: filter },
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: pageSize },
      {
        $project: {
          title: 1,
          description: 1,
          draft: 1,
          updatedAt: 1,
          questionCount: { $size: "$questions" }, // count questions on DB side
        },
      },
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

    return res.status(200).json({
      message: "Quiz fetched successfully",
      data: quiz,
      errors: null,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};
