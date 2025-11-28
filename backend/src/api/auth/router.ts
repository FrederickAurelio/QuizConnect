import { Router } from "express";
import {
  getUser,
  loginUser,
  logoutUser,
  registerUser,
  resetPasswordUser,
  sendCode,
} from "./controller.js";

const authRoute = Router();

authRoute.post("/register", registerUser);
authRoute.post("/login", loginUser);
authRoute.post("/logout", logoutUser);
authRoute.post("/code", sendCode);
authRoute.post("/reset", resetPasswordUser);

authRoute.get("/initial", getUser);

export default authRoute;
