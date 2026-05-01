import dotenv from "dotenv";
import { logExplain } from "./ai-explain-log.js";

dotenv.config({ path: ".env.local" });

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/** Per-request cap; finalize can send large JSON so default is generous. Set to 0 to disable timeout. */
const OPENROUTER_REQUEST_TIMEOUT_MS =
  Number(process.env.OPENROUTER_REQUEST_TIMEOUT_MS ?? 300_000) || 0;

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
export const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "stepfun/step-3.5-flash:free";
export const OPENROUTER_WEB_DECIDER_MODEL =
  process.env.OPENROUTER_WEB_DECIDER_MODEL?.trim() || OPENROUTER_MODEL;
const OPENROUTER_HTTP_REFERER = process.env.OPENROUTER_HTTP_REFERER || "";
const OPENROUTER_APP_TITLE = process.env.OPENROUTER_APP_TITLE || "QuizGame";

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * Calls OpenRouter chat completions and returns the assistant message content and resolved model id.
 */
export async function completeChatJson(params: {
  messages: OpenRouterMessage[];
  model?: string;
}): Promise<{ content: string; model: string }> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set.");
  }

  const model = params.model ?? OPENROUTER_MODEL;

  logExplain("OpenRouter: outgoing request", {
    url: OPENROUTER_URL,
    model,
    // response_format: "json_object",
    messages: params.messages.map((m) => ({
      role: m.role,
      contentLength: m.content.length,
      content: m.content,
    })),
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  };
  if (OPENROUTER_HTTP_REFERER) {
    headers["HTTP-Referer"] = OPENROUTER_HTTP_REFERER;
  }
  if (OPENROUTER_APP_TITLE) {
    headers["X-OpenRouter-Title"] = OPENROUTER_APP_TITLE;
  }

  const payload = JSON.stringify({
    model,
    messages: params.messages,
    // response_format: "json_object",
  });

  const init: RequestInit = {
    method: "POST",
    headers,
    body: payload,
  };
  if (OPENROUTER_REQUEST_TIMEOUT_MS > 0) {
    init.signal = AbortSignal.timeout(OPENROUTER_REQUEST_TIMEOUT_MS);
  }

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, init);
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new Error(
        `OpenRouter request timed out after ${OPENROUTER_REQUEST_TIMEOUT_MS}ms (see OPENROUTER_REQUEST_TIMEOUT_MS).`,
      );
    }
    throw e;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `OpenRouter request failed: ${res.status} ${res.statusText} — ${text.slice(0, 500)}`,
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenRouter returned an empty assistant message.");
  }

  const trimmed = content.trim();
  logExplain("OpenRouter: assistant reply", {
    model,
    contentLength: trimmed.length,
    contentPreview: trimmed.slice(0, 800),
  });

  return { content: trimmed, model };
}
