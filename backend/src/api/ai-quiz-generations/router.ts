import { Router } from "express";
import {
  createAiQuizGeneration,
  deleteAiQuizGeneration,
  getAiQuizGeneration,
  listAiQuizGenerations,
  validatePreparedChunksForGeneration,
} from "./controller.js";
import { isAuthenticated } from "../auth/controller.js";

const aiQuizGenerationsRouter = Router();

aiQuizGenerationsRouter.post(
  "/validate-prepared",
  isAuthenticated,
  validatePreparedChunksForGeneration,
);
aiQuizGenerationsRouter.get("/", isAuthenticated, listAiQuizGenerations);
aiQuizGenerationsRouter.get(
  "/:generationId",
  isAuthenticated,
  getAiQuizGeneration,
);
aiQuizGenerationsRouter.delete(
  "/:generationId",
  isAuthenticated,
  deleteAiQuizGeneration,
);
aiQuizGenerationsRouter.post("/", isAuthenticated, createAiQuizGeneration);

export default aiQuizGenerationsRouter;
