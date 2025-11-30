import { Router } from "express";
import {
  createQuiz,
  updateQuiz,
  deleteQuiz,
  getQuizzes,
  getDetailQuiz,
  copyQuiz,
} from "./controller.js";
import { isAuthenticated } from "../auth/controller.js";

const quizRouter = Router();

quizRouter.post("/create", isAuthenticated, createQuiz);
quizRouter.put("/update/:id", isAuthenticated, updateQuiz);
quizRouter.delete("/delete/:id", isAuthenticated, deleteQuiz);
quizRouter.post("/copy/:id", isAuthenticated, copyQuiz);

quizRouter.get("/", isAuthenticated, getQuizzes);
quizRouter.get("/:id", isAuthenticated, getDetailQuiz);

export default quizRouter;
