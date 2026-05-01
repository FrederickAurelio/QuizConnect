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

export function buildFinalizeOutputSchema(questionCount: number) {
  return z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000),
    questions: z.array(finalizeQuestionSchema).length(questionCount),
  });
}

export type FinalizeLlmOutput = z.infer<
  ReturnType<typeof buildFinalizeOutputSchema>
>;
