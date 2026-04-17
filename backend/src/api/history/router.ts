import { Router } from "express";
import { isAuthenticated } from "../auth/controller.js";
import { getHistories, getHistoryDetail } from "./controller.js";
import { postHistoryQuestionExplain } from "./explain/controller.js";
import { postHistorySessionAnalytics } from "./analytics/controller.js";

const historyRouter = Router();

historyRouter.get("/", isAuthenticated, getHistories);
historyRouter.post(
  "/:gameId/explain",
  isAuthenticated,
  postHistoryQuestionExplain,
);
historyRouter.post(
  "/:gameId/analytics",
  isAuthenticated,
  postHistorySessionAnalytics,
);
historyRouter.get("/:gameId", getHistoryDetail);
export default historyRouter;
