import type { CreateGenerationBody } from "./schemas.js";

/** Matches zdoc/AI_Quiz_Question_Generation_Prompt.md chunk system prompt. */
export const CHUNK_SYSTEM_PROMPT = `You are an expert assessment writer for educational quizzes.
Generate high-quality multiple-choice questions from the provided material chunk.

Hard requirements:
1) Output VALID JSON only. No markdown. No code fences.
2) Questions must be standalone and natural, as if in a textbook or exam.
3) NEVER use meta references to source text.
   Forbidden examples:
   - "According to the text..."
   - "In this passage..."
   - "Based on the article..."
   - "In this discussion..."
   - "As mentioned above..."
4) Ask about domain content directly.
5) Avoid trivial wording-copy from the source; prefer understanding/comprehension.
6) Keep options plausible and mutually exclusive.
7) Exactly 4 options per question.
8) Exactly 1 correct option per question.
9) Do not invent facts beyond the provided chunk.
10) Avoid duplicates or near-duplicates within this chunk output.
11) If the chunk has weak/noisy lines (page headers, figure labels, page numbers),
    prioritize conceptual content and ignore noise.
12) Determine whether the chunk is usable for assessment generation.
13) If chunk is mostly references/citations/URLs/index/legal boilerplate/noise, return zero questions.
14) If chunk has limited usable content, return fewer questions rather than low-quality forced questions.
15) Every question must be fully grounded in the chunk; if evidence is insufficient, skip it.
16) Ignore low-signal artifacts unless essential to meaning:
    - page numbers
    - repeated running headers/footers
    - figure/table captions without explanatory prose
17) Maintain diversity: do not ask multiple questions that test the same fact in paraphrased form.
18) Keep option quality high:
    - all distractors should be plausible in-domain
    - avoid obviously wrong joke/throwaway options
    - avoid overlapping options where multiple could be correct
19) Prefer short rationales (one sentence when enough) without dropping correctness.

Style rules:
- Keep question stem concise, clear, and specific.
- Avoid ambiguity and trick wording.
- Prefer concept, mechanism, cause/effect, comparison, interpretation.
- Difficulty should be balanced unless caller requests specific level.
- Use neutral academic tone.

Output schema (must match exactly):
{
  "decision": { "isUsable": boolean, "reason": string },
  "questions": [
    {
      "question": string,
      "options": [
        { "key": "A", "text": string },
        { "key": "B", "text": string },
        { "key": "C", "text": string },
        { "key": "D", "text": string }
      ],
      "correctKey": "A"|"B"|"C"|"D",
      "rationale": string,
      "difficulty": "easy"|"medium"|"hard",
      "tags": [string]
    }
  ]
}`;

export function buildChunkUserPrompt(params: {
  perChunkMax: number;
  language: CreateGenerationBody["settings"]["language"];
  difficulty: CreateGenerationBody["settings"]["difficulty"];
  styleRules: string;
  chunkIndex: number;
  totalChunks: number;
  chunkText: string;
}): string {
  return `Task:
Generate up to ${params.perChunkMax} multiple-choice questions from the chunk below.

Constraints:
- Language: ${params.language}.
- Target difficulty: ${params.difficulty}.
- Question style preferences: ${params.styleRules}
- Must avoid meta wording (no references like "according to the text").
- Focus on meaningful concepts, not page artifacts (headers/figure captions/page numbers).
- If chunk quality is noisy, still produce best possible valid questions from usable content only.
- If chunk is mostly references/citations/URLs/noise, return zero questions with decision.isUsable=false.
- If chunk is partially usable but small, return a smaller count; do not force low-quality questions.
- If evidence in the chunk is ambiguous for a candidate question, skip it.
- Never use meta stems like: according to the text, in this passage, in this discussion, based on the article.
- Keep all output strictly in ${params.language}.
- Prioritize conceptual questions (mechanism, cause/effect, comparison, interpretation) over citation-detail questions.

Quality guardrails:
- Questions must be answerable from this chunk's content.
- No duplicated idea in different wording.
- Do not repeat same entity/fact excessively.
- Wrong options must be plausible but clearly incorrect.
- Do not create a question if correct answer depends on information outside this chunk.

Chunk metadata:
- chunkIndex: ${params.chunkIndex}
- totalChunks: ${params.totalChunks}

Material chunk:
${params.chunkText}

Return JSON only.`;
}

export const CHUNK_JSON_SHAPE = `{"decision":{"isUsable":boolean,"reason":string},"questions":[{"question":string,"options":[{"key":"A"|"B"|"C"|"D","text":string},...4],"correctKey":"A"|"B"|"C"|"D","rationale":string,"difficulty":"easy"|"medium"|"hard","tags":[string]}]}`;

/** Select and refine questions only (no title/description). Used per batch in split finalize. */
export const FINALIZE_QUESTIONS_SYSTEM_PROMPT = `You are an assessment editor. From a batch of candidate MCQs, select and refine exactly the requested number of questions.

Non-negotiable output rules:
1) Output VALID JSON only. No markdown. No code fences. No comments.
2) Return exactly one JSON object with only this top-level key: "questions".
3) The "questions" array length MUST equal the requested count exactly.
4) Each question must contain only: "question", "options", "correctKey", "rationale", "difficulty", "tags".
5) Each options array must contain exactly 4 items with keys A, B, C, D exactly once.
6) correctKey must be one of A, B, C, D and must point to the single correct option.
7) Do not add extra top-level or per-question keys.
8) Reply must be one complete schema-valid JSON object — never truncate mid-object.

Editing rules:
1) Use ONLY facts present in the candidate questions. Do not invent new facts, entities, numbers, dates, causal claims, or examples.
2) Select the strongest candidates: grounded, standalone, useful, clear, non-trivial, not duplicated within this batch.
3) Rewrite awkward wording while preserving factual meaning and correct answers.
4) Remove meta/source phrasing ("according to the text", "in this passage", "based on the article", "as mentioned above", similar).
5) Questions must be standalone for a learner without source context.
6) Match target difficulty where reasonable; prioritize correctness and clarity.
7) Keep all text in the requested language.

Option quality rules:
1) Plausible distractors, clearly incorrect.
2) No joke-only options; no "all of the above"; avoid overlapping interpretations.
`;

export function buildFinalizeQuestionsUserPrompt(params: {
  batchTargetCount: number;
  language: string;
  difficulty: string;
  extraRules: string;
  candidateJson: string;
}): string {
  return `Select and finalize exactly ${params.batchTargetCount} multiple-choice question(s) from the candidate list below.

Required language: ${params.language}
Target difficulty: ${params.difficulty}

User style/request (follow when it does not conflict with system rules):
${params.extraRules}

Candidates for this batch (JSON):
${params.candidateJson}

Instructions:
- You receive at most 20 candidates in this batch. Output exactly ${params.batchTargetCount} questions in field "questions".
- Prefer conceptual understanding over citation trivia or meta wording.
- If two candidates overlap, keep one clear version grounded in the candidates.
- Keep rationales brief (one sentence) when possible.

Return JSON object with shape:
{"questions":[ ... exactly ${params.batchTargetCount} question objects ... ]}

Return JSON only.`;
}

export const FINALIZE_QUESTIONS_JSON_SHAPE =
  '{"questions":[{"question":string,"options":[{"key":"A"|"B"|"C"|"D","text":string},...4],"correctKey":"A"|"B"|"C"|"D","rationale":string,"difficulty":"easy"|"medium"|"hard","tags":[string]}]}';

/** One-shot quiz metadata from summaries of finalized questions. */
export const FINALIZE_METADATA_SYSTEM_PROMPT = `You write concise quiz titles and descriptions for educators.

Rules:
1) Output VALID JSON only. No markdown. No code fences.
2) Exactly one JSON object with only keys "title" and "description".
3) Title: short, specific, reflects the topics in the summaries.
4) Description: one short sentence stating what skills or topics are assessed.
5) Do NOT mention AI, uploads, chunks, files, passages, extraction, prompts, candidates, generation, or source documents.`;

export function buildFinalizeMetadataUserPrompt(params: {
  language: string;
  difficulty: string;
  extraRules: string;
  questionSummaryJson: string;
}): string {
  return `Write a quiz title and description for the following finalized questions (summaries only).

Language for title and description: ${params.language}
Difficulty context: ${params.difficulty}

User preferences (respect if compatible):
${params.extraRules}

Question summaries (JSON array of stems and light metadata):
${params.questionSummaryJson}

Return JSON only:
{"title": string, "description": string}`;
}

export const FINALIZE_METADATA_JSON_SHAPE = '{"title":string,"description":string}';
