import mongoose from "mongoose";

const ALLOWED_MIME = ["application/pdf", "text/plain"] as const;

export type AiPreparedMimeType = (typeof ALLOWED_MIME)[number];

const aiPreparedMaterialSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      ref: "User",
    },
    originalFileName: { type: String, required: true, trim: true },
    mimeType: {
      type: String,
      required: true,
      enum: ALLOWED_MIME,
    },
    fileSizeBytes: { type: Number, required: true, min: 1 },
    cleanTexts: {
      type: [String],
      required: true,
      validate: {
        validator(value: unknown) {
          return (
            Array.isArray(value) &&
            value.length > 0 &&
            value.every(
              (chunk) => typeof chunk === "string" && chunk.trim().length > 0,
            )
          );
        },
        message:
          "Prepared material must contain at least one non-empty text chunk.",
      },
    },
    rawCharCount: { type: Number, required: true, min: 0 },
    cleanCharCount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      required: true,
      enum: ["READY"],
      default: "READY",
    },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

aiPreparedMaterialSchema.index({ userId: 1, createdAt: -1 });
aiPreparedMaterialSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const AiPreparedMaterial = mongoose.model(
  "AiPreparedMaterial",
  aiPreparedMaterialSchema,
);
export default AiPreparedMaterial;
