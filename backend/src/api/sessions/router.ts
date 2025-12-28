import { Router } from "express";
import { isAuthenticated } from "../auth/controller.js";
import {
  checkLobbyStatus,
  getLobby,
  getYourAnswer,
  hostQuiz,
} from "./controller.js";

const sessionRouter = Router();

sessionRouter.post("/host", isAuthenticated, hostQuiz);
sessionRouter.get("/:gameCode", getLobby);
sessionRouter.get("/answer/:gameCode", getYourAnswer);
sessionRouter.post("/check/:gameCode", checkLobbyStatus);

export default sessionRouter;
