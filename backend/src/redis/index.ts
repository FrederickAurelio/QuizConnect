import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export const EXPIRY_SECONDS = 3600 * 3;
export const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redis.on("error", (err) => {
  console.error("Redis error:", err);
});

export const connectRedis = async () => {
  if (!redis.isOpen) {
    await redis.connect();
    console.log("Redis connected");
  }
};
