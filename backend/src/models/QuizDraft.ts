import mongoose from "mongoose";
import { questionSchema } from "./Quiz.js";

const quizDraftSchema = new mongoose.Schema(
  {
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      unique: true,
      index: true,
      ref: "Quiz",
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    questions: {
      type: [questionSchema],
      default: [],
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "User",
    },
  },
  { timestamps: true },
);

const QuizDraft = mongoose.model("QuizDraft", quizDraftSchema);
export default QuizDraft;
