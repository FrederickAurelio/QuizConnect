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
import { connectRedis, redis } from "./utils/redis.js";
import { setupSocket } from "./utils/socket.js";
import http from "http";
import sessionRouter from "./api/sessions/router.js";

dotenv.config();

// Initial setup and middleware
mongoose
  .connect("mongodb://localhost:27017/QuizzConnect")
  .then(() => console.log("Connected to Database"))
  .catch((err) => console.error(err));

const PORT = process.env.PORT || 2000;
const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "DELETE", "PUT"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Expires",
      "Pragma",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));

// Session setup with secure settings
app.use(
  session({
    secret: process.env.SESSION_SECRET || "defaultFallbackSecret",
    saveUninitialized: false,
    resave: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 120000 * 60, // 120mins
    },
    store: MongoStore.create({
      client: mongoose.connection.getClient(),
    }),
  })
);

const server = http.createServer(app);

// Redis
connectRedis();
// WebSocket
setupSocket(server);

app.use("/auth", authRoute);
app.use("/quiz", quizRouter);
app.use("/sessions", sessionRouter);

// Middleware to refresh session expiration
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.session) req.session.touch();
  next();
});

// Centralized error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send({ error: "Something went wrong" });
});

export { app, PORT };
