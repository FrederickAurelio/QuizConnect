import { Router } from "express";
import { isAuthenticated } from "../auth/controller.js";
import { getLobby, hostQuiz } from "./controller.js";

const sessionRouter = Router();

sessionRouter.post("/host", isAuthenticated, hostQuiz);
sessionRouter.get("/:gameCode", getLobby);

export default sessionRouter;
