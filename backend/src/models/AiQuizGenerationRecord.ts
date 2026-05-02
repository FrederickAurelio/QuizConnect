import mongoose from "mongoose";

const generationChunkSchema = new mongoose.Schema(
  {
    globalChunkIndex: { type: Number, required: true, min: 0 },
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "AiPreparedMaterial",
    },
    materialChunkIndex: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "RUNNING", "DONE", "FAILED", "SKIPPED"],
    },
    candidateCount: { type: Number, default: 0, min: 0 },
    attemptCount: { type: Number, default: 0, min: 0 },
    errorMessage: { type: String, trim: true },
  },
  { _id: false },
);

const generationProgressSchema = new mongoose.Schema(
  {
    stage: {
      type: String,
      required: true,
      enum: [
        "queued",
        "load_materials",
        "chunk_generation",
        "finalize",
        "persist_quiz",
        "done",
        "failed",
      ],
      default: "queued",
    },
    chunkTotal: { type: Number, default: 0, min: 0 },
    chunkDone: { type: Number, default: 0, min: 0 },
    chunkFailed: { type: Number, default: 0, min: 0 },
    chunkSkipped: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const generationSettingsSchema = new mongoose.Schema(
  {
    questionCount: { type: Number, required: true, min: 1, max: 50 },
    difficulty: {
      type: String,
      required: true,
      enum: ["easy", "medium", "hard"],
    },
    language: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const generationOutputSchema = new mongoose.Schema(
  {
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: "Quiz" },
    quizTitle: { type: String, trim: true },
    quizDescription: { type: String, trim: true },
    questionCount: { type: Number, min: 0 },
  },
  { _id: false },
);

const generationErrorSchema = new mongoose.Schema(
  {
    stage: { type: String, trim: true },
    message: { type: String, trim: true },
  },
  { _id: false },
);

const aiQuizGenerationRecordSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "User",
    },
    preparedFileIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "AiPreparedMaterial" }],
      required: true,
      validate: {
        validator(value: unknown) {
          return Array.isArray(value) && value.length >= 1 && value.length <= 3;
        },
        message: "Between 1 and 3 prepared file ids are required.",
      },
    },
    status: {
      type: String,
      required: true,
      enum: ["PROCESSING", "DONE", "FAILED"],
      default: "PROCESSING",
      index: true,
    },
    promptText: { type: String, required: true, trim: true },
    settings: { type: generationSettingsSchema, required: true },
    /** Primary model id used for chunk + finalize calls (resolved at runtime). */
    model: { type: String, trim: true, default: "" },
    progress: { type: generationProgressSchema, required: true },
    chunks: { type: [generationChunkSchema], default: [] },
    output: { type: generationOutputSchema },
    error: { type: generationErrorSchema },
    /** Redis lock key pattern owner; stored for debugging. */
    lockKey: { type: String, trim: true },
  },
  { timestamps: true },
);

aiQuizGenerationRecordSchema.index({ userId: 1, createdAt: -1 });

/** At most one actively processing generation per user at DB level. */
aiQuizGenerationRecordSchema.index(
  { userId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "PROCESSING" },
  },
);

const AiQuizGenerationRecord = mongoose.model(
  "AiQuizGenerationRecord",
  aiQuizGenerationRecordSchema,
);
export default AiQuizGenerationRecord;
