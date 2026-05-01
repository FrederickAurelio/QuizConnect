import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import multer from "multer";
import { isAuthenticated } from "../auth/controller.js";
import { deletePreparedMaterial, prepareMaterial } from "./controller.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  /** Default multer uses latin1; UTF-8 filenames (e.g. Chinese) would become mojibake. */
  defParamCharset: "utf8",
});

function handlePrepareUpload(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          message: "File too large. Maximum is 10MB per file.",
          data: null,
          errors: null,
        });
      }
      return res.status(400).json({
        message: err.message,
        data: null,
        errors: null,
      });
    }
    return res.status(400).json({
      message: err instanceof Error ? err.message : "Upload failed.",
      data: null,
      errors: null,
    });
  });
}

const aiQuizMaterialsRouter = Router();

aiQuizMaterialsRouter.post(
  "/prepare",
  isAuthenticated,
  handlePrepareUpload,
  prepareMaterial,
);

aiQuizMaterialsRouter.delete(
  "/:preparedFileId",
  isAuthenticated,
  deletePreparedMaterial,
);

export default aiQuizMaterialsRouter;
