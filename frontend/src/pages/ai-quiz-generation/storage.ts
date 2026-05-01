import type {
  AiGenerationSettings,
  PreparedMaterial,
} from "@/api/ai-quiz-generation";
import {
  MAX_PREPARED_MATERIALS,
  normalizeQuestionCount,
} from "@/pages/ai-quiz-generation/constants";

const STORAGE_KEY = "ai-quiz-generation:draft-v1";

const PREPARED_STATUSES = new Set<PreparedMaterial["status"]>([
  "PROCESSING",
  "READY",
  "FAILED",
]);

export type AiGenerationDraftStorage = {
  promptText: string;
  settings: AiGenerationSettings;
  /** Up to 3 prepared materials. */
  preparedMaterials: PreparedMaterial[];
};

export const DEFAULT_AI_SETTINGS: AiGenerationSettings = {
  questionCount: 10,
  difficulty: "medium",
  language: "English",
};

function materialExpiresAt(m: { expiresAt: string }): number {
  return Date.parse(m.expiresAt);
}

/** True when the server window has ended (invalid / missing time counts as expired). */
export function isPreparedMaterialExpired(m: PreparedMaterial): boolean {
  const t = materialExpiresAt(m);
  if (Number.isNaN(t)) return true;
  return t <= Date.now();
}


function isPreparedMaterial(x: unknown): x is PreparedMaterial {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (
    typeof o.preparedFileId !== "string" ||
    typeof o.fileName !== "string" ||
    typeof o.mimeType !== "string" ||
    typeof o.status !== "string" ||
    !PREPARED_STATUSES.has(o.status as PreparedMaterial["status"]) ||
    typeof o.expiresAt !== "string" ||
    typeof o.createdAt !== "string" ||
    typeof o.fileSizeBytes !== "number" ||
    typeof o.cleanCharCount !== "number"
  ) {
    return false;
  }
  return true;
}

function parsePreparedMaterialsList(value: unknown): PreparedMaterial[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const materials: PreparedMaterial[] = [];
  for (const item of value) {
    if (!isPreparedMaterial(item) || isPreparedMaterialExpired(item)) continue;
    materials.push(item);
  }
  return materials.slice(0, MAX_PREPARED_MATERIALS);
}

function parseSettings(value: unknown): AiGenerationSettings | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Record<string, unknown>;
  const questionCount = s.questionCount;
  const difficulty = s.difficulty;
  const language = s.language;
  if (
    typeof questionCount !== "number" ||
    !["easy", "medium", "hard"].includes(difficulty as string) ||
    !["English", "Chinese"].includes(language as string)
  ) {
    return null;
  }
  return {
    questionCount: normalizeQuestionCount(questionCount),
    difficulty: difficulty as AiGenerationSettings["difficulty"],
    language: language as AiGenerationSettings["language"],
  };
}

export function loadAiGenerationDraft(): AiGenerationDraftStorage | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AiGenerationDraftStorage>;
    if (!parsed || typeof parsed !== "object") return null;

    return {
      promptText: typeof parsed.promptText === "string" ? parsed.promptText : "",
      settings: parseSettings(parsed.settings) ?? DEFAULT_AI_SETTINGS,
      preparedMaterials: parsePreparedMaterialsList(parsed.preparedMaterials),
    };
  } catch {
    return null;
  }
}

export function saveAiGenerationDraft(data: AiGenerationDraftStorage) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearAiGenerationDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
