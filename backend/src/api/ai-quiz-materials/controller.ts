import type { Request, Response } from "express";
import { Types } from "mongoose";
import AiPreparedMaterial from "../../models/AiPreparedMaterial.js";
import { handleControllerError } from "../../utils/handle-control-error.js";
import {
  chunkMaterialText,
  cleanMaterialText,
  extractPlainTextFromUpload,
  type AllowedMime,
} from "./material-text.js";
import { MAX_PREPARED_UPLOAD_BYTES } from "./upload-limits.js";

const TTL_MS = 24 * 60 * 60 * 1000;

const ALLOWED_MIME_SET = new Set<AllowedMime>(["application/pdf", "text/plain"]);

function resolveMime(file: Express.Multer.File): AllowedMime | null {
  if (ALLOWED_MIME_SET.has(file.mimetype as AllowedMime)) {
    return file.mimetype as AllowedMime;
  }
  const lower = file.originalname.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".txt")) return "text/plain";
  return null;
}

function toClientMaterial(doc: InstanceType<typeof AiPreparedMaterial>) {
  return {
    preparedFileId: String(doc._id),
    fileName: doc.originalFileName,
    mimeType: doc.mimeType,
    fileSizeBytes: doc.fileSizeBytes,
    cleanCharCount: doc.cleanCharCount,
    status: "READY" as const,
    createdAt: doc.createdAt!.toISOString(),
    expiresAt: doc.expiresAt.toISOString(),
  };
}

export const prepareMaterial = async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId || req.session.type !== "auth") {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }

    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({
        message: "Missing file. Send multipart field \"file\".",
        data: null,
        errors: null,
      });
    }

    const mimeType = resolveMime(file);
    if (!mimeType) {
      return res.status(400).json({
        message: "Only PDF and TXT files are allowed.",
        data: null,
        errors: null,
      });
    }

    if (file.size > MAX_PREPARED_UPLOAD_BYTES) {
      return res.status(413).json({
        message: "File too large. Maximum is 5MB per file.",
        data: null,
        errors: null,
      });
    }

    const rawText = await extractPlainTextFromUpload({
      buffer: file.buffer,
      mimeType,
    });
    const { text: cleanText, rawCharCount, cleanCharCount } =
      cleanMaterialText(rawText);
    const cleanTexts = chunkMaterialText(cleanText);

    const expiresAt = new Date(Date.now() + TTL_MS);
    const doc = await AiPreparedMaterial.create({
      userId: new Types.ObjectId(String(userId)),
      originalFileName: file.originalname || "upload",
      mimeType,
      fileSizeBytes: file.size,
      cleanTexts,
      rawCharCount,
      cleanCharCount,
      status: "READY",
      expiresAt,
    });

    return res.status(201).json({
      message: "Material prepared successfully",
      data: toClientMaterial(doc),
      errors: null,
    });
  } catch (error: unknown) {
    return handleControllerError(res, error);
  }
};

export const deletePreparedMaterial = async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    if (!userId || req.session.type !== "auth") {
      return res.status(401).json({
        message: "Unauthorized!",
        data: null,
        errors: null,
      });
    }

    const { preparedFileId } = req.params;
    if (!preparedFileId || !Types.ObjectId.isValid(preparedFileId)) {
      return res.status(400).json({
        message: "Invalid prepared file id.",
        data: null,
        errors: null,
      });
    }

    await AiPreparedMaterial.deleteOne({
      _id: new Types.ObjectId(preparedFileId),
      userId: new Types.ObjectId(String(userId)),
    });

    return res.status(200).json({
      message: "Prepared material removed.",
      data: null,
      errors: null,
    });
  } catch (error: unknown) {
    return handleControllerError(res, error);
  }
};
