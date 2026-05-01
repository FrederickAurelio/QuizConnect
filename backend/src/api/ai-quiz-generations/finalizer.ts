import { parseJsonWithOptionalFence } from "../history/shared.js";
import {
  FINALIZE_JSON_SHAPE_PREFIX,
  FINALIZE_SYSTEM_PROMPT,
  buildFinalizeUserPrompt,
} from "./prompts.js";
import {
  type FinalizeLlmOutput,
  buildFinalizeOutputSchema,
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
  const schema = buildFinalizeOutputSchema(params.questionCount);
  const candidateJson = JSON.stringify(
    { questions: params.candidates },
    null,
    2,
  );
  const userContent = buildFinalizeUserPrompt({
    finalCount: params.questionCount,
    language: params.language,
    difficulty: params.difficulty,
    extraRules: params.extraRules,
    candidateJson,
  });

  let { content } = await completeChatJson({
    model,
    messages: [
      { role: "system", content: FINALIZE_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  });

  let parsed = parseJsonWithOptionalFence(content, schema);
  if (!parsed) {
    ({ content } = await completeChatJson({
      model,
      messages: [
        { role: "system", content: FINALIZE_SYSTEM_PROMPT },
        { role: "user", content: userContent },
        { role: "assistant", content },
        {
          role: "user",
          content:
            "Your previous output was invalid. Reply with exactly one JSON object matching: " +
            FINALIZE_JSON_SHAPE_PREFIX +
            `. questions array must have length exactly ${params.questionCount}.`,
        },
      ],
    }));
    parsed = parseJsonWithOptionalFence(content, schema);
  }

  if (!parsed) {
    const err = new Error("Finalize LLM output could not be parsed as valid JSON.");
    (err as { statusCode?: number }).statusCode = 502;
    throw err;
  }

  return { output: parsed, model };
}
