import { parseJsonWithOptionalFence } from "../history/shared.js";
import {
  FINALIZE_JSON_SHAPE_PREFIX,
  FINALIZE_SYSTEM_PROMPT,
  buildFinalizeUserPrompt,
} from "./prompts.js";
import {
  type FinalizeLlmOutput,
  buildFinalizeSelectionOutputSchema,
} from "./schemas.js";
import {
  completeChatJson,
  OPENROUTER_MODEL,
} from "../../utils/openrouter.js";
import type { ChunkLlmOutput } from "./schemas.js";

function quizGenModel(): string {
  return process.env.OPENROUTER_QUIZ_GEN_MODEL?.trim() || OPENROUTER_MODEL;
}

export async function runFinalizeLlm(params: {
  questionCount: number;
  language: string;
  difficulty: string;
  extraRules: string;
  candidates: ChunkLlmOutput["questions"];
}): Promise<{ output: FinalizeLlmOutput; model: string }> {
  const model = quizGenModel();
  const candidateCount = params.candidates.length;
  const selectionSchema = buildFinalizeSelectionOutputSchema(
    params.questionCount,
    candidateCount,
  );

  const candidateJson = JSON.stringify(
    {
      candidates: params.candidates.map((q, index) => ({
        index,
        question: q.question,
        options: q.options,
        correctKey: q.correctKey,
        ...(q.rationale !== undefined ? { rationale: q.rationale } : {}),
        ...(q.difficulty !== undefined ? { difficulty: q.difficulty } : {}),
        ...(q.tags !== undefined ? { tags: q.tags } : {}),
      })),
    },
    null,
    2,
  );

  const userContent = buildFinalizeUserPrompt({
    finalCount: params.questionCount,
    candidateCount,
    language: params.language,
    difficulty: params.difficulty,
    extraRules: params.extraRules,
    candidateJson,
  });

  const repairSuffix =
    "Your previous output was invalid or did not validate. Reply with exactly one JSON object matching: " +
    FINALIZE_JSON_SHAPE_PREFIX +
    `. The selectedQuestionIndexes array MUST have length exactly ${params.questionCount}, ` +
    `with UNIQUE integers only, each between 0 and ${Math.max(
      0,
      candidateCount - 1,
    )} inclusive (candidate indices). ` +
    "Return JSON only.";

  let { content } = await completeChatJson({
    model,
    messages: [
      { role: "system", content: FINALIZE_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  });

  let parsed = parseJsonWithOptionalFence(content, selectionSchema);
  if (!parsed) {
    ({ content } = await completeChatJson({
      model,
      messages: [
        { role: "system", content: FINALIZE_SYSTEM_PROMPT },
        { role: "user", content: userContent },
        { role: "assistant", content },
        { role: "user", content: repairSuffix },
      ],
    }));
    parsed = parseJsonWithOptionalFence(content, selectionSchema);
  }

  if (!parsed) {
    const err = new Error("Finalize LLM output could not be parsed as valid JSON.");
    (err as { statusCode?: number }).statusCode = 502;
    throw err;
  }

  const questions = parsed.selectedQuestionIndexes.map((i) => {
    const q = params.candidates[i];
    if (!q) {
      const err = new Error(
        `Finalize index ${i} out of range after validation (candidateCount=${candidateCount}).`,
      );
      (err as { statusCode?: number }).statusCode = 502;
      throw err;
    }
    return q;
  });

  const output: FinalizeLlmOutput = {
    title: parsed.title.trim(),
    description: (parsed.description ?? "").trim(),
    questions,
  };

  return { output, model };
}
