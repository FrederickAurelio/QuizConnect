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

export const FINALIZE_SYSTEM_PROMPT = `You are an assessment editor. Finalize a set of candidate MCQs into one publishable quiz draft.

Non-negotiable output rules:
1) Output VALID JSON only. No markdown. No code fences. No comments.
2) Return exactly one JSON object with only these top-level keys: "title", "description", "questions".
3) The "questions" array length MUST equal the requested final count exactly.
4) Each question must contain only these keys: "question", "options", "correctKey", "rationale", "difficulty", "tags".
5) Each options array must contain exactly 4 items with keys A, B, C, D exactly once.
6) correctKey must be one of A, B, C, D and must point to the single correct option.
7) Do not add extra fields.

Editing rules:
1) Use ONLY facts present in the candidate questions. Do not invent new facts, entities, numbers, dates, causal claims, or examples.
2) Select the strongest candidates first: grounded, standalone, useful, non-trivial, clear, and not duplicated.
3) Remove duplicates and near-duplicates, including questions testing the same fact with different wording.
4) Rewrite awkward wording, but preserve factual meaning.
5) Remove all meta/source phrasing:
   - "according to the text"
   - "in this passage"
   - "based on the article"
   - "as mentioned above"
   - any similar wording that refers to source material instead of the subject.
6) Questions must be standalone: a learner should understand the question without seeing the source text.
7) Prefer conceptual/comprehension questions over citation trivia, page artifacts, filenames, headers, footers, or formatting details.
8) Keep the requested target difficulty. If candidates vary in quality, prioritize correctness and clarity over matching difficulty perfectly.
9) Keep all final question text, options, title, and description in the requested language.

Option quality rules:
1) Distractors must be plausible in-domain but clearly wrong.
2) Avoid joke options, "all of the above", "none of the above", and overlapping options.
3) Avoid options that differ only by tiny wording changes unless the distinction is truly meaningful.
4) Ensure no option accidentally also satisfies the question.

Quiz metadata rules:
1) Title must be concise, specific, and based on the candidate subject matter.
2) Description must be one short sentence summarizing what the quiz assesses.
3) Do not mention chunks, candidates, uploaded files, source text, AI, or generation process.`;

export function buildFinalizeUserPrompt(params: {
  finalCount: number;
  language: string;
  difficulty: string;
  extraRules: string;
  candidateJson: string;
}): string {
  return `Finalize these candidate MCQs into a publishable quiz draft.

Required final question count: ${params.finalCount}
Required language: ${params.language}
Target difficulty: ${params.difficulty}

User style/rule request (follow only when it does not conflict with system rules):
${params.extraRules}

Candidate questions JSON:
${params.candidateJson}

Selection instructions:
- Choose exactly ${params.finalCount} final questions.
- If more candidates are provided, discard weak, duplicated, ambiguous, too-easy, or source-meta questions.
- If two candidates test the same idea, keep only the clearer and more educational one.
- Normalize every final question so it is standalone and does not refer to "text", "passage", "article", "material", "chunk", "source", or "document".
- Keep the answer key correct after rewriting options.
- Keep each question concise, but do not remove necessary context.
- Preserve or improve rationales when present; if rationale is missing, write a brief rationale grounded only in the candidate.
- Use tags sparingly: 1-4 short subject tags per question.

Return exactly one JSON object. It must match this shape and contain no extra keys:
{
  "title": string,
  "description": string,
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
}

The questions array must contain exactly ${params.finalCount} items. Return JSON only.`;
}

export const FINALIZE_JSON_SHAPE_PREFIX =
  '{"title":string,"description":string,"questions":[...]}';
