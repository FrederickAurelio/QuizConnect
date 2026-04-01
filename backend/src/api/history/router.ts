import { Router } from "express";
import { isAuthenticated } from "../auth/controller.js";
import { getHistories, getHistoryDetail } from "./controller.js";
import { postHistoryQuestionExplain } from "./history-explain.controller.js";

const historyRouter = Router();

historyRouter.get("/", isAuthenticated, getHistories);
historyRouter.post(
  "/:gameId/explain",
  isAuthenticated,
  postHistoryQuestionExplain
);
historyRouter.get("/:gameId", getHistoryDetail);
export default historyRouter;
