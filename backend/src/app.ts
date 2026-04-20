"use strict";
import express, { Request, Response, NextFunction } from "express";
import session from "express-session";
import mongoose from "mongoose";
import MongoStore from "connect-mongo";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import authRoute from "./api/auth/router.js";
import quizRouter from "./api/quiz/router.js";
import { connectRedis } from "./redis/index.js";
import http from "http";
import sessionRouter from "./api/sessions/router.js";
import { setupSocket } from "./sockets/index.js";
import historyRouter from "./api/history/router.js";

// Local dev: load from .env.local. In Docker, env vars come from docker-compose (no file).
dotenv.config({ path: ".env.local" });

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/QuizzConnect";

// Initial setup and middleware
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Connected to Database"))
  .catch((err) => console.error(err));

const PORT = Number(process.env.PORT) || 2000;
const app = express();
const DEFAULT_SESSION_COOKIE_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
const SESSION_COOKIE_MAX_AGE_MS = Number(
  process.env.SESSION_COOKIE_MAX_AGE_MS ?? DEFAULT_SESSION_COOKIE_MAX_AGE_MS,
);
const DEFAULT_SESSION_STORE_TTL_SECONDS = Math.ceil(
  SESSION_COOKIE_MAX_AGE_MS / 1000,
);
const SESSION_STORE_TTL_SECONDS = Math.max(
  Number(
    process.env.SESSION_STORE_TTL_SECONDS ?? DEFAULT_SESSION_STORE_TTL_SECONDS,
  ),
  DEFAULT_SESSION_STORE_TTL_SECONDS,
);

const server = http.createServer(app);

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3221";
app.use(
  cors({
    origin: corsOrigin,
    methods: ["GET", "POST", "DELETE", "PUT"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Expires",
      "Pragma",
    ],
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));

// Session setup with secure settings
export const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "defaultFallbackSecret",
  saveUninitialized: false,
  resave: false,
  rolling: true, // This is crucial for constantly renewing the client cookie's
  cookie: {
    httpOnly: true,
    // Use secure cookies only when explicitly enabled (e.g. behind HTTPS)
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
  },
  store: MongoStore.create({
    client: mongoose.connection.getClient(),
    ttl: SESSION_STORE_TTL_SECONDS,
    // touchAfter throttles DB writes for touch operations; rolling cookie refresh still applies.
    touchAfter: 300,
    // ----------------------------------------
  }),
});
app.use(sessionMiddleware);

// Redis
connectRedis();
// WebSocket
const io = setupSocket(server);

// now you can use io.use
const wrap = (middleware: any) => (socket: any, next: any) =>
  middleware(socket.request, {} as any, next);

io.use(wrap(sessionMiddleware));

io.use((socket, next) => {
  const req = socket.request as any;

  if (!req.session?.userId) {
    return next(new Error("Unauthorized"));
  }

  socket.data.user = {
    _id: req.session.userId,
    username: req.session.username,
    avatar: req.session.avatar,
  };

  next();
});

// Middleware to refresh session expiration (run for every request)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.session) req.session.touch();
  next();
});

// API routes under /api so frontend baseURL "/api" works when served from same host
const apiRouter = express.Router();
apiRouter.get("/health", (_req, res) => res.status(200).json({ status: "ok" }));
apiRouter.use("/auth", authRoute);
apiRouter.use("/quiz", quizRouter);
apiRouter.use("/sessions", sessionRouter);
apiRouter.use("/history", historyRouter);
app.use("/api", apiRouter);

// Centralized error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send({ error: "Something went wrong" });
});

export { app, PORT, server };
