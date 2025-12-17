import { Router } from "express";
import {
  editProfileUser,
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

authRoute.post("/edit-profile", editProfileUser);

authRoute.get("/initial", getUser);

export default authRoute;
