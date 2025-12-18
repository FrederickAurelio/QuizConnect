import { Router } from "express";
import { isAuthenticated } from "../auth/controller.js";
import { checkLobbyStatus, getLobby, hostQuiz } from "./controller.js";

const sessionRouter = Router();

sessionRouter.post("/host", isAuthenticated, hostQuiz);
sessionRouter.get("/:gameCode", getLobby);
sessionRouter.post("/check/:gameCode", checkLobbyStatus);

export default sessionRouter;
