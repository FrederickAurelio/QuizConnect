import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env.local" });

/**
 * Latest explain run only: overwritten on each step. Path default:
 * `<cwd>/logs/ai-explain-latest.json` (backend `logs/` is gitignored).
 * Override with AI_EXPLAIN_LOG_FILE (absolute or relative to cwd).
 *
 * Set LOG_AI_EXPLAIN=0 to disable file writes entirely.
 */

type ExplainStep = {
  at: string;
  section: string;
  detail?: unknown;
};

type Session = {
  startedAt: string;
  meta: Record<string, unknown>;
  steps: ExplainStep[];
};

let session: Session | null = null;

export function isAiExplainLogEnabled(): boolean {
  return process.env.LOG_AI_EXPLAIN !== "0";
}

export function getAiExplainLogFilePath(): string {
  const fromEnv = process.env.AI_EXPLAIN_LOG_FILE?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv)
      ? fromEnv
      : path.join(process.cwd(), fromEnv);
  }
  return path.join(process.cwd(), "logs", "ai-explain-latest.json");
}

function flushToFile(): void {
  if (!isAiExplainLogEnabled() || !session) return;
  const filePath = getAiExplainLogFilePath();
  const dir = path.dirname(filePath);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const payload = {
      ...session,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, safeReplacer, 2), "utf8");
  } catch (e) {
    console.error("[ai-explain] failed to write log file:", filePath, e);
  }
}

function safeReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

/**
 * Call once per explain request, before any logExplain / Tavily / OpenRouter logs.
 * Resets the in-memory session; the file is replaced with this run only.
 */
export function beginAiExplainLog(meta: Record<string, unknown>): void {
  if (!isAiExplainLogEnabled()) return;
  session = {
    startedAt: new Date().toISOString(),
    meta,
    steps: [],
  };
  flushToFile();
}

export function logExplain(section: string, detail?: unknown): void {
  if (!isAiExplainLogEnabled()) return;
  if (!session) {
    session = {
      startedAt: new Date().toISOString(),
      meta: {
        note: "beginAiExplainLog() was not called; steps may be incomplete",
      },
      steps: [],
    };
  }
  session.steps.push({
    at: new Date().toISOString(),
    section,
    detail,
  });
  flushToFile();
}

/**
 * Optional: mark final status (appended as last step, then flushed).
 */
export function finalizeAiExplainLog(
  status: "success" | "error",
  detail?: unknown
): void {
  if (!isAiExplainLogEnabled()) return;
  logExplain(`explain: finished (${status})`, detail);
}
