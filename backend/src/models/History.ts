import mongoose from "mongoose";
import { questionSchema } from "./Quiz.js";

const answerLogSchema = new mongoose.Schema(
  {
    questionIndex: {
      type: Number,
      required: true,
    },
    optionIndex: {
      type: Number,
      default: null,
    },
    key: {
      type: String,
      enum: ["A", "B", "C", "D"],
      default: null,
    },
    score: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);
const playerSnapshotSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    guestId: {
      type: String,
      default: null,
    },
    username: String,
    avatar: String,
    totalScore: Number,
  },
  { _id: false }
);
const historyQuerySchema = new mongoose.Schema(
  {
    gameCode: String,
    quiz: {
      title: String,
      description: String,
      questionCount: Number,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "User",
    },
    players: {
      type: [mongoose.Schema.Types.ObjectId],
      index: true,
      ref: "User",
    },
    playerCount: Number,
    winner: {
      type: playerSnapshotSchema,
    },
    sessionCreatedAt: String,
  },
  { timestamps: true }
);

const historyDetailSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HistoryQuery",
      unique: true,
      index: true,
    },
    gameCode: {
      type: String,
    },
    quiz: {
      title: String,
      description: String,
      questions: {
        type: [questionSchema],
        default: [],
      },
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    players: {
      type: [playerSnapshotSchema],
    },
    settings: {
      maxPlayers: Number,
      questionCount: Number,
      shuffleQuestions: Boolean,
      shuffleAnswers: Boolean,
      timePerQuestion: String,
      cooldown: String,
    },
    sessionCreatedAt: String,
  },
  { timestamps: true }
);

const historyPlayerResultSchema = new mongoose.Schema({
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "HistoryQuery",
    index: true,
  },
  player: {
    type: playerSnapshotSchema,
    required: true,
  },
  totalScore: Number,
  rank: Number,
  answers: {
    type: [answerLogSchema],
    default: [],
  },
});

export const HistoryQuery = mongoose.model("HistoryQuery", historyQuerySchema);
export const HistoryDetail = mongoose.model(
  "HistoryDetail",
  historyDetailSchema
);
export const HistoryPlayerResult = mongoose.model(
  "HistoryPlayerResult",
  historyPlayerResultSchema
);
