import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env.local" });

/**
 * Append-only lifecycle log for AI quiz generation jobs (finalize, etc.).
 * Default path: `<cwd>/logs/ai-quiz-generation.log` (gitignored alongside other logs).
 * Override with AI_QUIZ_GENERATION_LOG_FILE (absolute or relative to cwd).
 * Disable with LOG_AI_QUIZ_GENERATION=0.
 *
 * Each append is followed by fsync so progress is visible while long OpenRouter
 * calls are in flight (avoids "only first line" confusion when the buffer sits in RAM).
 */
export function isAiQuizGenerationLogEnabled(): boolean {
  return process.env.LOG_AI_QUIZ_GENERATION !== "0";
}

export function getAiQuizGenerationLogFilePath(): string {
  const fromEnv = process.env.AI_QUIZ_GENERATION_LOG_FILE?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(process.cwd(), fromEnv);
  }
  return path.join(process.cwd(), "logs", "ai-quiz-generation.log");
}

export function logAiQuizGeneration(
  section: string,
  detail?: Record<string, unknown>,
): void {
  if (!isAiQuizGenerationLogEnabled()) return;
  const filePath = getAiQuizGenerationLogFilePath();
  const dir = path.dirname(filePath);
  const row = {
    at: new Date().toISOString(),
    section,
    ...(detail ? { detail } : {}),
  };
  const line = JSON.stringify(row) + "\n";
  try {
    fs.mkdirSync(dir, { recursive: true });
    const fd = fs.openSync(filePath, "a");
    try {
      fs.writeSync(fd, Buffer.from(line, "utf8"));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } catch (e) {
    console.error("[ai-quiz-generation] failed to append log file:", filePath, e);
  }
}
