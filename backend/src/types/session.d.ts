import "express-session";
import { Types } from "mongoose";

declare module "express-session" {
  interface SessionData {
    userId: Types.ObjectId | string;
    type: "auth" | "guest";
    username?: string;
    avatar?: string;
  }
}
