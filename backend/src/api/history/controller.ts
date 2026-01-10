import { Request, Response } from "express";
import { Types } from "mongoose";
import { handleControllerError } from "../../utils/handle-control-error.js";
import {
  HistoryDetail,
  HistoryPlayerResult,
  HistoryQuery,
} from "../../models/History.js";
import User from "../../models/User.js";

// ---------------- GET HISTORIES WITH PAGINATION (Aggregation) ----------------
export const getHistories = async (req: Request, res: Response) => {
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

    const type = req.query.type as "host" | "play";
    if (type !== "host" && type !== "play") {
      return res
        .status(400)
        .json({ message: "Invalid type", data: null, errors: null });
    }

    const filter: any = {};
    const userObjectId = new Types.ObjectId(userId);
    if (type === "host") filter.host = userObjectId;
    if (type === "play") filter.players = userObjectId;

    const [{ total = 0 } = {}] = await HistoryQuery.aggregate([
      { $match: filter },
      { $count: "total" },
    ]);
    const hasNext = page * pageSize < total;

    const histories = await HistoryQuery.aggregate([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: pageSize },
      {
        $lookup: {
          from: User.collection.name, // "users"
          localField: "host",
          foreignField: "_id",
          as: "hostUser",
        },
      },
      {
        $addFields: {
          host: {
            $cond: [
              { $gt: [{ $size: "$hostUser" }, 0] },
              {
                _id: { $arrayElemAt: ["$hostUser._id", 0] },
                username: { $arrayElemAt: ["$hostUser.username", 0] },
                avatar: { $arrayElemAt: ["$hostUser.avatar", 0] },
              },
              "$host",
            ],
          },
        },
      },
      {
        $lookup: {
          from: User.collection.name, // "users"
          localField: "winner.userId",
          foreignField: "_id",
          as: "winnerUser",
        },
      },
      {
        $addFields: {
          winner: {
            $cond: [
              { $gt: [{ $size: "$winnerUser" }, 0] },
              {
                userId: "$winner.userId",
                guestId: "$winner.guestId",
                username: { $arrayElemAt: ["$winnerUser.username", 0] },
                avatar: { $arrayElemAt: ["$winnerUser.avatar", 0] },
                totalScore: "$winner.totalScore",
              },
              "$winner",
            ],
          },
        },
      },

      ...(type === "play"
        ? [
            {
              $lookup: {
                from: HistoryPlayerResult.collection.name,
                let: { gameId: "$_id" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$gameId", "$$gameId"] },
                          { $eq: ["$player.userId", userObjectId] },
                        ],
                      },
                    },
                  },
                  {
                    $project: {
                      _id: 0,
                      totalScore: 1,
                      rank: 1,
                    },
                  },
                ],
                as: "myResult",
              },
            },
            {
              $addFields: {
                myResult: { $ifNull: ["$myResult", null] },
              },
            },
          ]
        : []),

      {
        $project: {
          gameCode: 1,
          quiz: 1,
          playerCount: 1,
          winner: 1,
          myResult: 1,
          sessionCreatedAt: 1,
          createdAt: 1,
          host: 1,
        },
      },
    ]);

    return res.status(200).json({
      message: "Hitories fetched successfully",
      data: {
        total,
        page,
        pageSize,
        hasNext,
        data: histories,
      },
      errors: null,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};

function buildPlayerQuery(userId: string) {
  if (userId.startsWith("guest_")) {
    return { "player.guestId": userId };
  }
  return {
    $or: [
      { "player.userId": new Types.ObjectId(userId) },
      { "player.guestId": userId },
    ],
  };
}

// ---------------- GET HISTORY DETAIL ----------------
export const getHistoryDetail = async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }

    const gameId = req.params.gameId;
    if (!gameId) {
      return res.status(404).json({
        message: "History Game not found",
        data: null,
        errors: null,
      });
    }

    const history = await HistoryDetail.aggregate([
      {
        $match: {
          _id: new Types.ObjectId(gameId),
        },
      },
      /* ---------------- HOST ---------------- */
      {
        $lookup: {
          from: "users",
          localField: "host",
          foreignField: "_id",
          as: "hostUser",
        },
      },
      {
        $addFields: {
          host: {
            $cond: [
              { $gt: [{ $size: "$hostUser" }, 0] },
              {
                _id: { $arrayElemAt: ["$hostUser._id", 0] },
                username: { $arrayElemAt: ["$hostUser.username", 0] },
                avatar: { $arrayElemAt: ["$hostUser.avatar", 0] },
              },
              "$host",
            ],
          },
        },
      },
      /* ---------------- PLAYERS ---------------- */
      {
        $lookup: {
          from: "users",
          localField: "players.userId",
          foreignField: "_id",
          as: "playerUsers",
        },
      },
      {
        $addFields: {
          players: {
            $map: {
              input: "$players",
              as: "player",
              in: {
                $let: {
                  vars: {
                    matchedUser: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$playerUsers",
                            as: "u",
                            cond: { $eq: ["$$u._id", "$$player.userId"] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                  in: {
                    $cond: [
                      { $ne: ["$$player.userId", null] },
                      {
                        userId: "$$player.userId",
                        username: "$$matchedUser.username",
                        avatar: "$$matchedUser.avatar",
                        totalScore: "$$player.totalScore",
                      },
                      {
                        guestId: "$$player.guestId",
                        username: "$$player.username",
                        avatar: "$$player.avatar",
                        totalScore: "$$player.totalScore",
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      /* ---------------- CLEANUP ---------------- */
      {
        $project: {
          hostUser: 0,
          playerUsers: 0,
        },
      },
    ]);

    if (!history.length) {
      return res.status(404).json({
        message: "History Game not found",
        data: null,
        errors: null,
      });
    }

    const historyData = history[0];

    let myAnswer = null;
    let playersAnswer = null;

    if (String(historyData?.host?._id) === String(userId)) {
      // const allPlayers = await HistoryPlayerResult.find({
      //   gameId: historyData._id,
      // })
      //   .select({
      //     _id: 0,
      //     gameId: 0,
      //     player: 1,
      //     answers: 1,
      //     totalScore: 0,
      //     rank: 0,
      //   })
      //   .lean();

      // const count = historyData.quiz.questions.length;
      // const result: any[][] = Array.from({ length: count }, () => []);

      // allPlayers.forEach((player) => {
      //   player.answers.forEach((answer) => {
      //     const index = Number(answer.questionIndex);

      //     if (Number.isInteger(index) && index >= 0 && index < result.length) {
      //       result[index]!.push(answer);
      //     }
      //   });
      // });
      const allPlayers = await HistoryPlayerResult.aggregate([
        { $match: { gameId: historyData._id } },
        { $unwind: "$answers" },
        {
          $group: {
            _id: "$answers.questionIndex",
            answers: {
              $push: {
                optionIndex: "$answers.optionIndex",
                key: "$answers.key",
                questionIndex: "$answers.questionIndex",
                score: "$answers.score",
                _id: {
                  $ifNull: ["$player.userId", "$player.guestId"],
                },
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const count = historyData.quiz.questions.length;
      const result: any[][] = Array.from({ length: count }, () => []);

      allPlayers.forEach((q) => {
        if (q._id >= 0 && q._id < count) {
          result[q._id] = q.answers;
        }
      });

      playersAnswer = result;
    } else {
      const myPlayer = await HistoryPlayerResult.findOne({
        gameId: historyData._id,
        ...buildPlayerQuery(userId as any),
      })
        .select({
          _id: 0,
          player: 1,
          answers: 1,
        })
        .lean();

      myAnswer = (myPlayer?.answers ?? []).sort(
        (a, b) => a.questionIndex - b.questionIndex
      );
    }

    return res.status(200).json({
      message: "History Game Detail fetched successfully",
      data: { ...historyData, playersAnswer, myAnswer },
      errors: null,
    });
  } catch (error) {
    return handleControllerError(res, error);
  }
};
