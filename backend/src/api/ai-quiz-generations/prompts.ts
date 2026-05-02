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

export const FINALIZE_SYSTEM_PROMPT = `You are an assessment editor. You CURATE candidate multiple-choice questions for one quiz.

You NEVER rewrite or regenerate question stems, option text, rationales, difficulties, tags, or correct answers.
Your ONLY job besides title/description is to choose WHICH candidate indexes to include by returning integers.

Non-negotiable output rules:
1) Output VALID JSON only. No markdown. No code fences. No commentary before or after the JSON.
2) Return exactly one JSON object with only these three top-level keys: "title", "description", "selectedQuestionIndexes".
3) selectedQuestionIndexes is an ARRAY of integers. Its length MUST equal the requested selection count exactly.
4) Each integer MUST be unique (no duplicates).
5) Each integer MUST be the "index" of a candidate from the provided candidates list (zero-based — first candidate has index 0).
6) Every integer MUST be within the inclusive range printed in the user message (typically 0 through N-1).
7) Do not add extra top-level keys. Do not wrap content in markdown.

Selection quality rules:
1) Pick the BEST set for the learner: grounded, standalone, clearly answerable, educationally meaningful, specific, and non-redundant.
2) Drop weak items: ambiguity, trivia about page/layout, broken or joke distractors, overlapping options where multiple answers could work, factual messiness.
3) Drop duplicates and NEAR-duplicates testing the same fact in different wording; keep ONE clearest formulation.
4) Prefer conceptual understanding (cause/effect, mechanism, contrast, inference) when quality is comparable.
5) Avoid questions that heavily rely on source-meta phrasing (“according to the text”, “this passage”, “the article”), unless all candidates suffer this — still prefer cleaner items.
6) Your title and description MUST reflect ONLY the TOPICS assessed by the INDEXES you picked (infer from those candidates’ stems and options).

Language:
- Title, description MUST be written in the user-specified quiz language even if stems are multilingual (then match the plurality of stems or primary language declared by the caller).

Tone for metadata:
- Title: concise (under ~80 characters when feasible), concrete topic name.
- Description: one crisp sentence naming skills/topics tested.
- Do NOT mention: chunks, files, uploads, passages, sourcing, prompts, indexes, selecting, ranking, AI, generation, databases, pipelines.`;

export function buildFinalizeUserPrompt(params: {
  finalCount: number;
  candidateCount: number;
  language: string;
  difficulty: string;
  extraRules: string;
  candidateJson: string;
}): string {
  const maxIdx = Math.max(0, params.candidateCount - 1);
  return `You will CURATE quiz content from STRUCTURED candidates.

TASK
1) Inspect every candidate listed in JSON below — each carries a ZERO-BASED "index" matching its array position starting at index 0.
2) SELECT EXACTLY ${params.finalCount} DISTINCT indexes you want kept in the FINAL quiz ORDER (ordering is your pedagogical sequencing).
3) WRITE "title" and "description" for the FINAL quiz AFTER you finalize which indexes matter.

Hard index rules:
- Allowed index range: integers from **0 through ${maxIdx}** inclusive (there are exactly ${params.candidateCount} candidates).
- Emit EXACTLY ${params.finalCount} integers inside "selectedQuestionIndexes".
- All integers MUST be UNIQUE (no duplicate picks).
- Do NOT invent indices outside ${0}..${maxIdx}.

Quiz settings:
- Quiz language required for TITLE + DESCRIPTION ONLY: ${params.language}
- Target difficulty context (guides what you KEEP / DROP bias): ${params.difficulty}

User extra instructions (respect only if compatible with HARD rules above):
${params.extraRules}

CANDIDATES JSON (each object includes numeric "index"):
${params.candidateJson}

OUTPUT JSON SCHEMA — return NOTHING else:

{
  "title": "<short quiz title reflecting picked topics ONLY>",
  "description": "<one sentence describing what learner is assessed on>",
  "selectedQuestionIndexes": [idx1, idx2, ...exactly_${params.finalCount}_total...]
}

Return JSON only — no preamble, no fences.`;
}

export const FINALIZE_JSON_SHAPE_PREFIX =
  '{"title":string,"description":string,"selectedQuestionIndexes":[number,...]}';
