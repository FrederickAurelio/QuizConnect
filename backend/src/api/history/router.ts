import { Router } from "express";
import { isAuthenticated } from "../auth/controller.js";
import { getHistories, getHistoryDetail } from "./controller.js";

const historyRouter = Router();

historyRouter.get("/", isAuthenticated, getHistories);
historyRouter.get("/:gameId", getHistoryDetail);
export default historyRouter;
