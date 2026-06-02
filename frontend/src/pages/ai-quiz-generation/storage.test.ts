/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAiGenerationDraft,
  DEFAULT_AI_SETTINGS,
  loadAiGenerationDraft,
  saveAiGenerationDraft,
  type AiGenerationDraftStorage,
} from "@/pages/ai-quiz-generation/storage";
import { MAX_PREPARED_MATERIALS } from "@/pages/ai-quiz-generation/constants";

const USER_A = "user_a";
const USER_B = "user_b";
const LEGACY_KEY = "ai-quiz-generation:draft-v1";
const USER_A_V2_KEY = `ai-quiz-generation:draft-v2:${USER_A}`;

function makeDraft(promptText: string): AiGenerationDraftStorage {
  return {
    promptText,
    settings: { ...DEFAULT_AI_SETTINGS, questionCount: 15 },
    preparedMaterials: [],
  };
}

function makeMaterial(overrides: Partial<AiGenerationDraftStorage["preparedMaterials"][number]> = {}) {
  const now = Date.now();
  return {
    preparedFileId: overrides.preparedFileId ?? `pf_${Math.random().toString(16).slice(2)}`,
    fileName: overrides.fileName ?? "material.pdf",
    mimeType: overrides.mimeType ?? "application/pdf",
    fileSizeBytes: overrides.fileSizeBytes ?? 1_024,
    cleanCharCount: overrides.cleanCharCount ?? 200,
    status: overrides.status ?? "READY",
    createdAt: overrides.createdAt ?? new Date(now - 10_000).toISOString(),
    expiresAt: overrides.expiresAt ?? new Date(now + 60_000).toISOString(),
    errorMessage: overrides.errorMessage,
  };
}

describe("ai quiz generation draft storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves and loads drafts per user key", () => {
    saveAiGenerationDraft(USER_A, makeDraft("draft from user A"));
    saveAiGenerationDraft(USER_B, makeDraft("draft from user B"));

    expect(loadAiGenerationDraft(USER_A)?.promptText).toBe("draft from user A");
    expect(loadAiGenerationDraft(USER_B)?.promptText).toBe("draft from user B");
  });

  it("clears only current user draft", () => {
    saveAiGenerationDraft(USER_A, makeDraft("to clear"));
    saveAiGenerationDraft(USER_B, makeDraft("keep me"));

    clearAiGenerationDraft(USER_A);

    expect(loadAiGenerationDraft(USER_A)).toBeNull();
    expect(loadAiGenerationDraft(USER_B)?.promptText).toBe("keep me");
  });

  it("migrates valid legacy v1 draft to scoped v2 key", () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(makeDraft("legacy data")));

    const loaded = loadAiGenerationDraft(USER_A);

    expect(loaded?.promptText).toBe("legacy data");
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(window.localStorage.getItem(USER_A_V2_KEY)).not.toBeNull();
  });

  it("does not overwrite existing scoped v2 draft during migration", () => {
    saveAiGenerationDraft(USER_A, makeDraft("new scoped"));
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(makeDraft("legacy data")));

    const loaded = loadAiGenerationDraft(USER_A);

    expect(loaded?.promptText).toBe("new scoped");
    expect(window.localStorage.getItem(LEGACY_KEY)).not.toBeNull();
  });

  it("drops invalid legacy payload when attempting migration", () => {
    window.localStorage.setItem(LEGACY_KEY, "{not-json");

    const loaded = loadAiGenerationDraft(USER_A);

    expect(loaded).toBeNull();
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
    expect(window.localStorage.getItem(USER_A_V2_KEY)).toBeNull();
  });

  it("keeps only valid and non-expired materials when loading", () => {
    const now = Date.now();
    const valid = makeMaterial({ preparedFileId: "valid_1" });
    const expired = makeMaterial({
      preparedFileId: "expired_1",
      expiresAt: new Date(now - 1_000).toISOString(),
    });
    const invalidShape = { preparedFileId: "bad", status: "READY" };

    window.localStorage.setItem(
      USER_A_V2_KEY,
      JSON.stringify({
        promptText: "mixed materials",
        settings: DEFAULT_AI_SETTINGS,
        preparedMaterials: [valid, expired, invalidShape],
      }),
    );

    const loaded = loadAiGenerationDraft(USER_A);
    expect(loaded?.preparedMaterials).toHaveLength(1);
    expect(loaded?.preparedMaterials[0]?.preparedFileId).toBe("valid_1");
  });

  it("limits prepared materials to max configured value", () => {
    const materials = Array.from({ length: MAX_PREPARED_MATERIALS + 2 }, (_, i) =>
      makeMaterial({ preparedFileId: `pf_${i}` }),
    );
    window.localStorage.setItem(
      USER_A_V2_KEY,
      JSON.stringify({
        promptText: "many materials",
        settings: DEFAULT_AI_SETTINGS,
        preparedMaterials: materials,
      }),
    );

    const loaded = loadAiGenerationDraft(USER_A);
    expect(loaded?.preparedMaterials).toHaveLength(MAX_PREPARED_MATERIALS);
    expect(loaded?.preparedMaterials.map((m) => m.preparedFileId)).toEqual([
      "pf_0",
      "pf_1",
      "pf_2",
    ]);
  });

  it("normalizes invalid or out-of-step settings to safe defaults", () => {
    window.localStorage.setItem(
      USER_A_V2_KEY,
      JSON.stringify({
        promptText: "bad settings",
        settings: {
          questionCount: 52,
          difficulty: "impossible",
          language: "Japanese",
        },
        preparedMaterials: [],
      }),
    );

    const loaded = loadAiGenerationDraft(USER_A);
    expect(loaded?.settings).toEqual(DEFAULT_AI_SETTINGS);
  });

  it("normalizes valid settings questionCount to configured step/range", () => {
    window.localStorage.setItem(
      USER_A_V2_KEY,
      JSON.stringify({
        promptText: "normalize count",
        settings: {
          questionCount: 47,
          difficulty: "hard",
          language: "Chinese",
        },
        preparedMaterials: [],
      }),
    );

    const loaded = loadAiGenerationDraft(USER_A);
    expect(loaded?.settings).toEqual({
      questionCount: 45,
      difficulty: "hard",
      language: "Chinese",
    });
  });

  it("handles missing prompt/settings/materials fields defensively", () => {
    window.localStorage.setItem(USER_A_V2_KEY, JSON.stringify({}));

    const loaded = loadAiGenerationDraft(USER_A);
    expect(loaded).toEqual({
      promptText: "",
      settings: DEFAULT_AI_SETTINGS,
      preparedMaterials: [],
    });
  });

  it("migrates legacy only once and isolates to requesting user", () => {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(makeDraft("legacy one-shot")));

    const userALoad = loadAiGenerationDraft(USER_A);
    const userBLoad = loadAiGenerationDraft(USER_B);

    expect(userALoad?.promptText).toBe("legacy one-shot");
    expect(userBLoad).toBeNull();
    expect(window.localStorage.getItem(`ai-quiz-generation:draft-v2:${USER_B}`)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_KEY)).toBeNull();
  });
});
