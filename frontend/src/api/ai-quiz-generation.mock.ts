import { normalizeQuestionCount } from "@/pages/ai-quiz-generation/constants";

export type PreparedMaterialStatus = "PROCESSING" | "READY" | "FAILED";
export type GenerationStatus = "PROCESSING" | "DONE" | "FAILED";

export type AiGenerationSettings = {
  questionCount: number;
  difficulty: "easy" | "medium" | "hard";
  language: "English" | "Chinese";
};

export type PreparedMaterial = {
  preparedFileId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  cleanCharCount: number;
  status: PreparedMaterialStatus;
  createdAt: string;
  expiresAt: string;
  errorMessage?: string;
};

export type GenerationItem = {
  generationId: string;
  preparedFileIds: string[];
  status: GenerationStatus;
  promptText: string;
  settings: AiGenerationSettings;
  model: string;
  createdAt: string;
  updatedAt: string;
  quizId?: string;
  quizTitle?: string;
  quizDescription?: string;
  errorMessage?: string;
};

export type PrepareMaterialInput = {
  file: {
    name: string;
    type: string;
    size: number;
    textSeed?: string;
  };
};

export type CreateGenerationInput = {
  /** 1–3 prepared material ids (see MAX_PREPARED_MATERIALS on frontend). */
  preparedFileIds: string[];
  promptText: string;
  settings: AiGenerationSettings;
};

const NETWORK_MS = {
  prepare: 800,
  deletePrepared: 400,
  createGeneration: 700,
  list: 250,
  detail: 250,
};

const MODEL = "stepfun/step-3.5-flash:free";

let preparedMaterials: PreparedMaterial[] = [];
let generations: GenerationItem[] = [];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function plusHoursIso(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function buildMockQuiz(
  promptText: string,
  questionCount: number,
  sourceFileCount: number,
) {
  const subject = promptText.trim().slice(0, 42) || "Generated Quiz";
  return {
    quizId: uid("quiz"),
    quizTitle: `${subject}${subject.length >= 42 ? "..." : ""}`,
    quizDescription: `AI-generated draft with ${questionCount} questions from ${sourceFileCount} file${sourceFileCount === 1 ? "" : "s"}.`,
  };
}

function maybeFail(probability: number) {
  return Math.random() < probability;
}

export async function prepareMaterial(input: PrepareMaterialInput) {
  await sleep(NETWORK_MS.prepare);
  const createdAt = nowIso();
  const base: PreparedMaterial = {
    preparedFileId: uid("prep"),
    fileName: input.file.name,
    mimeType: input.file.type,
    fileSizeBytes: input.file.size,
    cleanCharCount: Math.max(300, Math.floor((input.file.size / 1024) * 45)),
    status: "PROCESSING",
    createdAt,
    expiresAt: plusHoursIso(24),
  };
  preparedMaterials = [base, ...preparedMaterials];

  await sleep(700);
  preparedMaterials = preparedMaterials.map((item) => {
    if (item.preparedFileId !== base.preparedFileId) return item;
    if (maybeFail(0.12)) {
      return {
        ...item,
        status: "FAILED",
        errorMessage: "Could not extract readable text from this file.",
      };
    }
    return { ...item, status: "READY" };
  });

  return preparedMaterials.find((i) => i.preparedFileId === base.preparedFileId)!;
}

export async function deletePreparedMaterial(preparedFileId: string) {
  await sleep(NETWORK_MS.deletePrepared);
  preparedMaterials = preparedMaterials.filter(
    (item) => item.preparedFileId !== preparedFileId,
  );
  return { ok: true };
}

export async function createGeneration(input: CreateGenerationInput) {
  await sleep(NETWORK_MS.createGeneration);

  if (!input.preparedFileIds?.length) {
    throw new Error("At least one prepared file id is required.");
  }
  const createdAt = nowIso();
  const questionCount = normalizeQuestionCount(input.settings.questionCount);
  const settings: AiGenerationSettings = {
    ...input.settings,
    questionCount,
  };
  const item: GenerationItem = {
    generationId: uid("gen"),
    preparedFileIds: [...input.preparedFileIds],
    status: "PROCESSING",
    promptText: input.promptText,
    settings,
    model: MODEL,
    createdAt,
    updatedAt: createdAt,
  };

  generations = [item, ...generations];
  return item;
}

export async function listGenerations() {
  await sleep(NETWORK_MS.list);
  return generations;
}

export async function getGenerationDetail(generationId: string) {
  await sleep(NETWORK_MS.detail);
  const current = generations.find((g) => g.generationId === generationId);
  if (!current) return null;

  if (current.status === "PROCESSING") {
    const ageMs = Date.now() - new Date(current.createdAt).getTime();
    if (ageMs > 5500) {
      const isFailed = maybeFail(0.18);
      if (isFailed) {
        const next = {
          ...current,
          status: "FAILED" as const,
          updatedAt: nowIso(),
          errorMessage: "Generation failed from invalid chunk output.",
        };
        generations = generations.map((g) =>
          g.generationId === generationId ? next : g,
        );
        return next;
      }

      const quiz = buildMockQuiz(
        current.promptText,
        current.settings.questionCount,
        current.preparedFileIds.length,
      );
      const next = {
        ...current,
        status: "DONE" as const,
        updatedAt: nowIso(),
        ...quiz,
      };
      generations = generations.map((g) =>
        g.generationId === generationId ? next : g,
      );
      return next;
    }
  }

  return generations.find((g) => g.generationId === generationId) ?? null;
}

export function getPreparedMaterial(preparedFileId: string) {
  return preparedMaterials.find((p) => p.preparedFileId === preparedFileId) ?? null;
}
