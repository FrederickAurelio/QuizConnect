import type {
  AiGenerationSettings,
  CreateGenerationInput,
  GenerationItem,
} from "@/api/ai-quiz-generation";
import { normalizeQuestionCount } from "@/pages/ai-quiz-generation/constants";

export type {
  AiGenerationSettings,
  CreateGenerationInput,
  GenerationItem,
  GenerationStatus,
  PreparedMaterial,
  PreparedMaterialStatus,
} from "@/api/ai-quiz-generation";

const NETWORK_MS = {
  createGeneration: 700,
  list: 250,
  detail: 250,
};

const MODEL = "stepfun/step-3.5-flash:free";

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
