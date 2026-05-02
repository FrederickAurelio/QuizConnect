import { z } from "zod";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

function hasExactlyOneOfEachOptionKey(
  options: Array<{ key: (typeof OPTION_KEYS)[number] }>,
): boolean {
  const keys = options.map((option) => option.key);
  return OPTION_KEYS.every((key) => keys.filter((item) => item === key).length === 1);
}

export const createGenerationBodySchema = z.object({
  preparedFileIds: z
    .array(z.string().min(1))
    .min(1)
    .max(3),
  promptText: z.string().trim().min(1).max(8000),
  settings: z.object({
    questionCount: z.number().int().min(5).max(50),
    difficulty: z.enum(["easy", "medium", "hard"]),
    language: z.enum(["English", "Chinese"]),
  }),
});

export type CreateGenerationBody = z.infer<typeof createGenerationBodySchema>;

export const validatePreparedChunksBodySchema = z.object({
  preparedFileIds: z.array(z.string().min(1)).min(1).max(3),
});

export type ValidatePreparedChunksBody = z.infer<
  typeof validatePreparedChunksBodySchema
>;

const chunkDecisionSchema = z.object({
  isUsable: z.boolean(),
  reason: z.string(),
});

const chunkOptionSchema = z.object({
  key: z.enum(["A", "B", "C", "D"]),
  text: z.string().min(1),
});

const chunkQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(chunkOptionSchema).length(4),
  correctKey: z.enum(["A", "B", "C", "D"]),
  rationale: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  tags: z.array(z.string()).optional(),
}).superRefine((question, ctx) => {
  if (!hasExactlyOneOfEachOptionKey(question.options)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["options"],
      message: "Options must contain keys A, B, C, and D exactly once.",
    });
  }
});

export const chunkLlmOutputSchema = z.object({
  decision: chunkDecisionSchema,
  questions: z.array(chunkQuestionSchema),
});

export type ChunkLlmOutput = z.infer<typeof chunkLlmOutputSchema>;

const finalizeOptionSchema = z.object({
  key: z.enum(["A", "B", "C", "D"]),
  text: z.string().min(1),
});

const finalizeQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(finalizeOptionSchema).length(4),
  correctKey: z.enum(["A", "B", "C", "D"]),
  rationale: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  tags: z.array(z.string()).optional(),
}).superRefine((question, ctx) => {
  if (!hasExactlyOneOfEachOptionKey(question.options)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["options"],
      message: "Options must contain keys A, B, C, and D exactly once.",
    });
  }
});

/** Orchestrator-visible finalize result (full MCQ objects). */
export const finalizeLlmOutputSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  questions: z.array(finalizeQuestionSchema),
});

export type FinalizeLlmOutput = z.infer<typeof finalizeLlmOutputSchema>;

/**
 * Raw OpenRouter finalize output: picker returns indices into the candidate array only.
 * selectionCount === final quiz size; candidateCount === candidates.length.
 */
export function buildFinalizeSelectionOutputSchema(
  selectionCount: number,
  candidateCount: number,
) {
  const maxIdx = candidateCount - 1;
  return z
    .object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000),
      selectedQuestionIndexes: z.array(z.number().int()),
    })
    .superRefine((val, ctx) => {
      const arr = val.selectedQuestionIndexes;
      if (candidateCount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["selectedQuestionIndexes"],
          message:
            "No candidates supplied; finalize selection cannot proceed.",
        });
        return;
      }
      if (arr.length !== selectionCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["selectedQuestionIndexes"],
          message: `Array must contain exactly ${selectionCount} indexes.`,
        });
        return;
      }
      const seen = new Set<number>();
      arr.forEach((idx, pos) => {
        if (!Number.isInteger(idx)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["selectedQuestionIndexes", pos],
            message: "Each entry must be an integer.",
          });
          return;
        }
        if (idx < 0 || idx > maxIdx) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["selectedQuestionIndexes", pos],
            message: `Index ${idx} is out of range for candidates (0-${maxIdx}).`,
          });
        }
        if (seen.has(idx)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["selectedQuestionIndexes", pos],
            message: `Duplicate index ${idx}; each picked question must appear once.`,
          });
        }
        seen.add(idx);
      });
    });
}

export type FinalizeSelectionLlmOutput = z.infer<
  ReturnType<typeof buildFinalizeSelectionOutputSchema>
>;
