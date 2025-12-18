import { Request, Response } from "express";
import z from "zod";
import { generateGameCode } from "../../utils/tools.js";
import { EXPIRY_SECONDS, redis } from "../../redis/index.js";
import Quiz from "../../models/Quiz.js";
import { Types } from "mongoose";
import { handleControllerError } from "../../utils/handle-control-error.js";
import { LobbyState } from "../../redis/lobby.js";

type PopulatedCreator = {
  _id: Types.ObjectId;
  username: string;
  avatar: string;
};

type QuizWithCreator = {
  _id: Types.ObjectId;
  title: string;
  description: string;
  questions: any[];
  creatorId: PopulatedCreator;
};

const hostQuizSchema = z.object({
  quizId: z.string().min(1, "Quiz ID is required"),
});
export const hostQuiz = async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }
    const { quizId } = hostQuizSchema.parse(req.body);
    if (!quizId) {
      return res.status(400).json({
        message: "Quiz not found",
        data: null,
        errors: null,
      });
    }

    const activeLobbyKey = `activeHostLobby:${userId}:${quizId}`;
    const existingGameCode = await redis.get(activeLobbyKey);

    let gameCode = "";
    do {
      gameCode = generateGameCode();
    } while (await redis.exists(`game:${gameCode}`));

    const quiz = (await Quiz.findOne({
      _id: new Types.ObjectId(quizId),
      creatorId: new Types.ObjectId(userId),
    })
      .select("title description questions creatorId")
      .populate("creatorId", "username avatar")
      .lean()) as QuizWithCreator | null;

    if (!quiz) {
      return res.status(404).json({
        message: "Quiz not found",
        data: null,
        errors: null,
      });
    }

    if (existingGameCode) {
      const lobbyExists = await redis.get(`game:${existingGameCode}`);
      if (lobbyExists) {
        const oldLobbyState: LobbyState = JSON.parse(lobbyExists);
        oldLobbyState.quiz.description = quiz.description;
        oldLobbyState.quiz.title = quiz.title;
        oldLobbyState.host.username =
          req.session.username ?? oldLobbyState.host.username;
        oldLobbyState.host.avatar =
          req.session.avatar ?? oldLobbyState.host.avatar;
        if (oldLobbyState.quiz.questionCount !== quiz.questions.length) {
          oldLobbyState.quiz.questionCount = quiz.questions.length;
          oldLobbyState.settings.questionCount = quiz.questions.length;
        }

        await redis.set(
          `game:${existingGameCode}`,
          JSON.stringify(oldLobbyState),
          {
            EX: EXPIRY_SECONDS,
          }
        );

        return res.status(200).json({
          message: "Lobby already active, returning existing game code.",
          data: {
            gameCode: existingGameCode,
          },
          errors: null,
        });
      } else {
        await redis.del(activeLobbyKey);
      }
    }

    const lobbyState = {
      gameCode,
      host: {
        _id: userId,
        username: quiz.creatorId.username,
        avatar: quiz.creatorId.avatar,
        online: true,
      },
      quiz: {
        _id: quizId,
        title: quiz.title,
        description: quiz.description,
        questionCount: quiz.questions.length,
      },
      settings: {
        maxPlayers: 8,
        questionCount: quiz.questions.length,
        shuffleQuestions: false,
        shuffleAnswers: false,
        timePerQuestion: "20",
        cooldown: "5",
      },
      players: [],
      status: "lobby",
      createdAt: Date.now(),
    };

    const transaction = redis
      .multi()
      .set(`game:${gameCode}`, JSON.stringify(lobbyState), {
        EX: EXPIRY_SECONDS,
      })
      .set(activeLobbyKey, gameCode, { EX: EXPIRY_SECONDS });

    await transaction.exec();

    return res.status(200).json({
      message: "Created Lobby successfully",
      data: {
        gameCode,
      },
      errors: null,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

export const getLobby = async (req: Request, res: Response) => {
  try {
    const { gameCode } = req.params;
    if (!gameCode) {
      return res.status(400).json({
        message: "Game code is required",
        data: null,
        errors: null,
      });
    }

    // 1️⃣ Fetch lobby from Redis
    const lobbyStr = await redis.get(`game:${gameCode}`);
    if (!lobbyStr) {
      return res.status(404).json({
        message: "Lobby not found or expired",
        data: null,
        errors: null,
      });
    }

    const lobby = JSON.parse(lobbyStr);

    return res.status(200).json({
      message: "Lobby fetched successfully",
      data: lobby,
      errors: null,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};
