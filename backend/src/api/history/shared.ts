import { z } from "zod";

export type HistoryQuestion = {
  question?: string | null;
  options?: { key?: string | null; text?: string | null }[];
  correctKey?: string | null;
};

/** Stored option index 0..3 → display key A–D (history explain + analytics facts). */
export const OPTION_INDEX_TO_KEY = ["A", "B", "C", "D"] as const;
export type OptionKey = (typeof OPTION_INDEX_TO_KEY)[number];

/** Map DB `optionIndex` or array slot index (0–3) to display key A–D. */
export function optionKeyFromIndex(
  index: number | null | undefined,
): OptionKey | null {
  if (index == null) return null;
  return OPTION_INDEX_TO_KEY[index] ?? null;
}

/** Whether `key` is a valid MCQ display key (A–D). */
export function isMcqOptionKey(key: string): key is OptionKey {
  return (OPTION_INDEX_TO_KEY as readonly string[]).includes(key);
}

export function toCorrectKeyByQuestion(
  question: HistoryQuestion,
): OptionKey | null {
  const options = question.options ?? [];
  const idx = options.findIndex((opt) => opt?.key === question.correctKey);
  return idx >= 0 ? optionKeyFromIndex(idx) : null;
}

export function parseJsonWithOptionalFence<TSchema extends z.ZodTypeAny>(
  raw: string,
  schema: TSchema,
): z.infer<TSchema> | null {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const toParse = jsonMatch ? jsonMatch[1]!.trim() : trimmed;
  try {
    const parsed = JSON.parse(toParse) as unknown;
    const out = schema.safeParse(parsed);
    return out.success ? out.data : null;
  } catch {
    return null;
  }
}

export function buildAiCacheEntry<TPayload>(payload: TPayload, model: string) {
  return {
    payload,
    model,
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
  };
}

export function isAiCacheEnvelope<TSchema extends z.ZodTypeAny>(
  x: unknown,
  schema: TSchema,
): x is {
  payload: z.infer<TSchema>;
  model: string;
  createdAt: string;
  schemaVersion?: number;
} {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const p = schema.safeParse(o.payload);
  return (
    p.success && typeof o.model === "string" && typeof o.createdAt === "string"
  );
}

export function toAiEnvelope<TPayload>(x: {
  payload: TPayload;
  model: string;
  createdAt: string;
  schemaVersion?: number;
}) {
  return {
    payload: x.payload,
    model: x.model,
    createdAt: x.createdAt,
    schemaVersion: x.schemaVersion ?? 1,
  };
}

export function handleAiControllerError(
  error: unknown,
  labels: {
    missingKeyMessage: string;
    parseFailMessage: string;
  },
) {
  if (
    error instanceof Error &&
    error.message === "OPENROUTER_API_KEY environment variable is not set."
  ) {
    return {
      status: 503 as const,
      body: {
        message: labels.missingKeyMessage,
        data: null,
        errors: null,
      },
    };
  }
  if ((error as any)?.statusCode === 502) {
    return {
      status: 502 as const,
      body: {
        message: (error as any).message ?? labels.parseFailMessage,
        data: null,
        errors: null,
      },
    };
  }
  return null;
}
