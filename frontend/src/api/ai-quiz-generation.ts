import type { ApiResponse } from "@/api";
import { api } from "@/lib/axios";
import type { AxiosError } from "axios";

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

export type CreateGenerationInput = {
  /** 1–3 prepared material ids (see MAX_PREPARED_MATERIALS on frontend). */
  preparedFileIds: string[];
  promptText: string;
  settings: AiGenerationSettings;
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Could not prepare file. Please try again.";
}

export async function prepareMaterial(file: File): Promise<PreparedMaterial> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await api.post<ApiResponse<PreparedMaterial>>(
      "/ai-quiz-materials/prepare",
      formData,
      { timeout: 120_000 },
    );
    const body = res.data;
    if (!body.data) {
      throw new Error(body.message ?? "Could not prepare file.");
    }
    return body.data;
  } catch (e: unknown) {
    const ax = e as AxiosError<ApiResponse<null>>;
    const msg = ax.response?.data?.message ?? getErrorMessage(e);
    throw new Error(msg);
  }
}

export async function deletePreparedMaterial(preparedFileId: string): Promise<void> {
  await api.delete<ApiResponse<null>>(
    `/ai-quiz-materials/${encodeURIComponent(preparedFileId)}`,
  );
}
