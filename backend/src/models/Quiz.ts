import mongoose from "mongoose";

const optionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      enum: ["A", "B", "C", "D"],
    },
    text: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    question: { type: String, trim: true },
    options: [optionSchema],
    correctKey: {
      type: String,
      enum: ["A", "B", "C", "D", ""],
    },
    done: { type: Boolean, default: false },
  },
  { _id: false }
);

const quizSchema = new mongoose.Schema(
  {
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
    draft: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// We validate the "Ready to Publish" rules here, once, at the top level.
quizSchema.pre("save", function (next) {
  // If it's a draft, skip strict validation
  if (this.draft) {
    return next();
  }

  // --- PUBLISHING RULES ---

  // 1. Check Question Count
  if (this.questions.length < 3) {
    return next(new Error("You need at least 3 questions to create the quiz."));
  }

  // 2. Validate every question
  for (const q of this.questions) {
    // Check Question Title
    if (!q.question || q.question.trim() === "") {
      return next(new Error(`Question "${q.id}" is missing a title.`));
    }

    // Check Correct Key
    if (!q.correctKey) {
      return next(
        new Error(`Question "${q.question}" is missing a correct answer.`)
      );
    }

    // Check Options Count
    if (q.options.length !== 4) {
      return next(
        new Error(`Question "${q.question}" must have exactly 4 options.`)
      );
    }

    // Check Option Text
    for (const opt of q.options) {
      if (!opt.text || opt.text.trim() === "") {
        return next(
          new Error(`An option in question "${q.question}" is empty.`)
        );
      }
    }
  }

  next();
});

const Quiz = mongoose.model("Quiz", quizSchema);
export default Quiz;
