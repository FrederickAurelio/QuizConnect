import { parseJsonWithOptionalFence } from "../history/shared.js";
import {
  CHUNK_JSON_SHAPE,
  CHUNK_SYSTEM_PROMPT,
  buildChunkUserPrompt,
} from "./prompts.js";
import {
  type ChunkLlmOutput,
  chunkLlmOutputSchema,
} from "./schemas.js";
import {
  completeChatJson,
  OPENROUTER_MODEL,
} from "../../utils/openrouter.js";
import type { CreateGenerationBody } from "./schemas.js";

function quizGenModel(): string {
  return process.env.OPENROUTER_QUIZ_GEN_MODEL?.trim() || OPENROUTER_MODEL;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withInfraRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
): Promise<T> {
  let lastErr: unknown;
  for (let a = 0; a < maxAttempts; a++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (a < maxAttempts - 1) {
        await sleep(400 * 2 ** a);
      }
    }
  }
  throw lastErr;
}

function parseChunkOutput(raw: string): ChunkLlmOutput | null {
  return parseJsonWithOptionalFence(raw, chunkLlmOutputSchema);
}

export type ChunkRunResult = {
  status: "DONE" | "SKIPPED" | "FAILED";
  questions: ChunkLlmOutput["questions"];
  model: string;
  attemptCount: number;
  skipOrFailReason?: string;
};

export async function runChunkLlm(params: {
  perChunkMax: number;
  language: CreateGenerationBody["settings"]["language"];
  difficulty: CreateGenerationBody["settings"]["difficulty"];
  styleRules: string;
  chunkIndex: number;
  totalChunks: number;
  chunkText: string;
}): Promise<ChunkRunResult> {
  const model = quizGenModel();
  const userContent = buildChunkUserPrompt({
    perChunkMax: params.perChunkMax,
    language: params.language,
    difficulty: params.difficulty,
    styleRules: params.styleRules,
    chunkIndex: params.chunkIndex,
    totalChunks: params.totalChunks,
    chunkText: params.chunkText,
  });

  let attemptCount = 0;

  const callOnce = async (messages: Parameters<typeof completeChatJson>[0]["messages"]) => {
    attemptCount++;
    return withInfraRetry(
      () => completeChatJson({ model, messages }),
      3,
    );
  };

  try {
    let { content } = await callOnce([
      { role: "system", content: CHUNK_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ]);

    let parsed = parseChunkOutput(content);
    if (!parsed) {
      ({ content } = await callOnce([
        { role: "system", content: CHUNK_SYSTEM_PROMPT },
        { role: "user", content: userContent },
        { role: "assistant", content },
        {
          role: "user",
          content:
            "Your previous output was invalid. Reply with exactly one JSON object matching this shape: " +
            CHUNK_JSON_SHAPE,
        },
      ]));
      parsed = parseChunkOutput(content);
    }

    if (!parsed) {
      return {
        status: "FAILED",
        questions: [],
        model,
        attemptCount,
        skipOrFailReason: "Invalid JSON or schema after repair",
      };
    }

    if (parsed.questions.length > params.perChunkMax) {
      return {
        status: "FAILED",
        questions: [],
        model,
        attemptCount,
        skipOrFailReason: `Too many questions (${parsed.questions.length} > ${params.perChunkMax})`,
      };
    }

    if (!parsed.decision.isUsable || parsed.questions.length === 0) {
      return {
        status: "SKIPPED",
        questions: [],
        model,
        attemptCount,
        skipOrFailReason: parsed.decision.reason || "Chunk not usable",
      };
    }

    return {
      status: "DONE",
      questions: parsed.questions,
      model,
      attemptCount,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: "FAILED",
      questions: [],
      model,
      attemptCount,
      skipOrFailReason: msg,
    };
  }
}
