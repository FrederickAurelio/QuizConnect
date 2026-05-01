import { Router } from "express";
import {
  createAiQuizGeneration,
  deleteAiQuizGeneration,
  getAiQuizGeneration,
  listAiQuizGenerations,
} from "./controller.js";
import { isAuthenticated } from "../auth/controller.js";

const aiQuizGenerationsRouter = Router();

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
