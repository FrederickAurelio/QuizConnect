import mongoose from "mongoose";
import { questionSchema } from "./Quiz.js";

const aiExplanationSourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    urlOrNote: { type: String, required: true },
  },
  { _id: false }
);

const aiExplanationPayloadSchema = new mongoose.Schema(
  {
    verifiedCorrectKey: {
      type: String,
      enum: ["A", "B", "C", "D", "NONE"],
      required: true,
    },
    agreesWithQuizKey: { type: Boolean, required: true },
    rationale: { type: String, required: true },
    feedback: { type: String, required: true },
    sources: {
      type: [aiExplanationSourceSchema],
      default: [],
    },
  },
  { _id: false }
);

const aiExplanationCacheSchema = new mongoose.Schema(
  {
    payload: { type: aiExplanationPayloadSchema, required: true },
    model: { type: String, required: true },
    createdAt: { type: String, required: true },
    schemaVersion: { type: Number, default: 1 },
  },
  { _id: false }
);

const aiAnalyticsInsightSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    detail: { type: String, required: true },
    evidence: {
      questionIndices: {
        type: [Number],
        default: [],
      },
    },
    relatedQuestionIndices: {
      type: [Number],
      default: [],
    },
  },
  { _id: false }
);

const aiAnalyticsPayloadSchema = new mongoose.Schema(
  {
    summary: { type: String, required: true },
    strengths: {
      type: [aiAnalyticsInsightSchema],
      default: [],
    },
    weaknesses: {
      type: [aiAnalyticsInsightSchema],
      default: [],
    },
    recommendations: {
      type: [aiAnalyticsInsightSchema],
      default: [],
    },
  },
  { _id: false }
);

const aiAnalyticsCacheSchema = new mongoose.Schema(
  {
    payload: { type: aiAnalyticsPayloadSchema, required: true },
    model: { type: String, required: true },
    createdAt: { type: String, required: true },
    schemaVersion: { type: Number, default: 1 },
  },
  { _id: false }
);

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
    answeredAt: {
      type: String,
    },
    aiExplanation: {
      type: aiExplanationCacheSchema,
      default: undefined,
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
      hostCanPlay: Boolean,
    },
    sessionCreatedAt: String,
    hostAiExplanations: {
      type: [
        new mongoose.Schema(
          {
            questionIndex: { type: Number, required: true },
            payload: { type: aiExplanationPayloadSchema, required: true },
            model: { type: String, required: true },
            createdAt: { type: String, required: true },
            schemaVersion: { type: Number, default: 1 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    hostAiAnalytics: {
      type: aiAnalyticsCacheSchema,
      default: undefined,
    },
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
  aiSessionAnalytics: {
    type: aiAnalyticsCacheSchema,
    default: undefined,
  },
});
historyPlayerResultSchema.index({
  gameId: 1,
  "player.userId": 1,
  "player.guestId": 1,
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
