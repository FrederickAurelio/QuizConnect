import {
  extractText,
  extractTextItems,
  type StructuredTextItem,
} from "unpdf";

/** After cleanup, reject if shorter than this (non-whitespace). */
const MIN_MEANINGFUL_CHARS = 40;

/** Stay under MongoDB 16MB doc limit with BSON overhead. */
export const MAX_CLEAN_TEXT_BYTES = 12 * 1024 * 1024;

export type AllowedMime = "application/pdf" | "text/plain";

function bufferUtf8ByteLength(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function isCjkCodePoint(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x3040 && cp <= 0x30ff) ||
    (cp >= 0xac00 && cp <= 0xd7af) ||
    (cp >= 0xf900 && cp <= 0xfaff)
  );
}

function lastCodePoint(str: string): number | undefined {
  if (!str.length) return undefined;
  const c = str[str.length - 1]!;
  return c.codePointAt(0);
}

function firstCodePoint(str: string): number | undefined {
  const c = str[0];
  return c?.codePointAt(0);
}

function itemRightEdge(item: StructuredTextItem): number {
  if (item.width > 0.5) return item.x + item.width;
  const fs = Math.max(item.fontSize, 6);
  return item.x + fs * item.str.length * 0.52;
}

/**
 * Group PDF text items into visual rows (top→bottom), merge tokens with spacing heuristics.
 */
function reconstructPageFromItems(items: StructuredTextItem[]): string {
  const filtered = items.filter((i) => i.str && i.str.trim().length > 0);
  if (filtered.length === 0) return "";

  const fontSizes = filtered.map((i) => i.fontSize).filter((f) => f > 0);
  const heights = filtered.map((i) => i.height).filter((h) => h > 0);
  const medFs = median(fontSizes.length ? fontSizes : [12]);
  const medH = median(heights.length ? heights : [medFs]);
  const tolerance = Math.max(2.2, medFs * 0.35, medH * 0.45);

  const sorted = [...filtered].sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: StructuredTextItem[][] = [];
  let row: StructuredTextItem[] = [];
  let rowY = 0;

  for (const it of sorted) {
    if (row.length === 0) {
      row.push(it);
      rowY = it.y;
      continue;
    }
    if (Math.abs(it.y - rowY) <= tolerance) {
      row.push(it);
      rowY = (rowY * (row.length - 1) + it.y) / row.length;
    } else {
      rows.push(row);
      row = [it];
      rowY = it.y;
    }
  }
  if (row.length) rows.push(row);

  const rowMeta = rows.map((r) => {
    const avgY = r.reduce((s, x) => s + x.y, 0) / r.length;
    const line = joinLineRow(r, medFs);
    return { avgY, line };
  });

  rowMeta.sort((a, b) => b.avgY - a.avgY);

  const gaps: number[] = [];
  for (let i = 0; i < rowMeta.length - 1; i++) {
    gaps.push(rowMeta[i]!.avgY - rowMeta[i + 1]!.avgY);
  }
  const medGap = median(gaps.length ? gaps : [medFs * 1.15]);
  const paraThreshold = Math.max(medFs * 1.05, medGap * 1.55);

  const parts: string[] = [];
  for (let i = 0; i < rowMeta.length; i++) {
    parts.push(rowMeta[i]!.line);
    if (i < rowMeta.length - 1) {
      const g = rowMeta[i]!.avgY - rowMeta[i + 1]!.avgY;
      parts.push(g >= paraThreshold ? "\n\n" : "\n");
    }
  }
  return parts.join("").trim();
}

function joinLineRow(items: StructuredTextItem[], medFs: number): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const spaceThreshold = Math.max(1.5, medFs * 0.18);
  let out = "";

  for (let i = 0; i < sorted.length; i++) {
    const it = sorted[i]!;
    let piece = it.str.replace(/\u00ad/g, "");
    if (i === 0) {
      out += piece;
      continue;
    }
    const prev = sorted[i - 1]!;
    const prevEnd = itemRightEdge(prev);
    const gap = it.x - prevEnd;
    const prevLast = lastCodePoint(prev.str);
    const curFirst = firstCodePoint(piece);
    const cjkTouch =
      prevLast !== undefined &&
      curFirst !== undefined &&
      isCjkCodePoint(prevLast) &&
      isCjkCodePoint(curFirst);

    const pieceStartsSpace = /^\s/.test(piece);
    const outEndsSpace = /\s$/.test(out);

    if (!cjkTouch && !pieceStartsSpace && !outEndsSpace) {
      if (gap > spaceThreshold) {
        out += " ";
      } else if (
        gap > 0.28 &&
        prevLast !== undefined &&
        curFirst !== undefined &&
        /[a-zA-Z\u00C0-\u024F]$/.test(prev.str) &&
        /^[a-zA-Z\u00C0-\u024F]/.test(piece)
      ) {
        out += " ";
      }
    }
    out += piece;
  }

  return out.replace(/\s+$/g, "").trimEnd();
}

async function extractPdfWithStructuredItems(
  data: Uint8Array,
): Promise<string[]> {
  const { totalPages, items } = await extractTextItems(data);
  if (!totalPages || !items.length) return [];

  return items.map((pageItems, i) => {
    const body = reconstructPageFromItems(pageItems);
    if (!body) return "";
    return `--- Page ${i + 1} ---\n${body}`;
  });
}

async function extractPdfWithHighLevelExtractText(
  data: Uint8Array,
): Promise<string[]> {
  const { text: pages, totalPages } = await extractText(data, {
    mergePages: false,
  });
  if (!totalPages || !pages.length) return [];
  return pages.map(
    (pageText, i) => `--- Page ${i + 1} ---\n${pageText ?? ""}`,
  );
}

/** Strip BOM and normalize newlines; keep tabs/newlines for later cleaning. */
function decodeTxtBuffer(buffer: Buffer): string {
  let s = buffer.toString("utf8");
  if (s.charCodeAt(0) === 0xfeff) {
    s = s.slice(1);
  }
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/** Remove control chars except newline and tab. */
function stripUnsafeControls(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    const code = c.codePointAt(0)!;
    if (code === 0x9 || code === 0xa) {
      out += c;
      continue;
    }
    if (code < 0x20 || code === 0x7f) {
      continue;
    }
    out += c;
  }
  return out;
}

/**
 * Put `--- Page N ---` on its own line.
 * PDF layout often glues the closing dashes to the next token (`--Proceedings`)
 * or drops the final `-` before a word; fix that before the generic glue case.
 */
function ensurePageMarkersOnOwnLine(text: string): string {
  let s = text;
  // Truncated closing run: "--- Page N --Word" (third `-` merged into next word)
  s = s.replace(
    /(--- Page (\d+) --)(?=[A-Za-z\u00C0-\u024F\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af])/g,
    "--- Page $2 ---\n",
  );
  // Full marker immediately followed by non-whitespace on the same line
  s = s.replace(/(--- Page \d+ ---)(?=[^\r\n\s])/g, "$1\n");
  return s;
}

/**
 * Remove long runs of lines that are only small integers (PDF line-number margin junk).
 * Keeps lines like `1. Introduction` (digit + dot + text).
 */
function stripRunsOfStandaloneLineNumbers(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let i = 0;
  const onlySmallInt = (line: string) => /^\s*\d{1,4}\s*$/.test(line);

  while (i < lines.length) {
    const line = lines[i]!;
    if (onlySmallInt(line)) {
      let j = i;
      while (j < lines.length && onlySmallInt(lines[j]!)) j++;
      const run = j - i;
      if (run >= 4) {
        i = j;
        continue;
      }
    }
    out.push(line);
    i++;
  }
  return out.join("\n");
}

export function cleanMaterialText(raw: string): {
  text: string;
  rawCharCount: number;
  cleanCharCount: number;
} {
  const rawCharCount = raw.length;
  let s = raw.normalize("NFKC");
  s = s.replace(/\u00a0/g, " ");
  s = stripUnsafeControls(s);

  s = ensurePageMarkersOnOwnLine(s);
  s = stripRunsOfStandaloneLineNumbers(s);

  // Latin hyphenation across hard newlines (avoid joining CJK)
  s = s.replace(/([a-zA-Z\u00C0-\u024F])-\n([a-zA-Z\u00C0-\u024F])/g, "$1$2");
  s = s.replace(/-\n([a-z])/g, "$1");
  s = s.replace(/-\n([A-Za-z\u00C0-\u024F])/g, "$1");

  const lines = s.split("\n");
  const cleanedLines: string[] = [];
  for (const line of lines) {
    const trimmedRight = line.replace(/[ \t]+$/g, "");
    const collapsed = trimmedRight.replace(/[ \t]+/g, " ").trimEnd();
    cleanedLines.push(collapsed);
  }

  let text = cleanedLines.join("\n").trim();
  text = text.replace(/\n{3,}/g, "\n\n");

  const cleanCharCount = text.length;
  const meaningful = text.replace(/\s+/g, "");
  if (meaningful.length < MIN_MEANINGFUL_CHARS) {
    throw new Error(
      "Could not extract enough readable text from this file. Try another PDF or TXT.",
    );
  }
  const bytes = bufferUtf8ByteLength(text);
  if (bytes > MAX_CLEAN_TEXT_BYTES) {
    throw new Error(
      "Extracted text is too large after cleaning. Try a smaller or simpler file.",
    );
  }
  return { text, rawCharCount, cleanCharCount };
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  return i > 0 ? i : fallback;
}

/**
 * Chunk sizing for quiz material (UTF‑16 code units).
 * Larger target/max ⇒ fewer `cleanTexts[]` entries ⇒ fewer chunk LLM calls later.
 * Override with env if needed (same names as below).
 */
const CHUNK_TARGET_DEFAULT = 4200;
const CHUNK_MAX_DEFAULT = 6800;
const CHUNK_OVERLAP_DEFAULT = 400;
const CHUNK_MIN_DEFAULT = 1000;

let chunkTarget = readPositiveIntEnv(
  "AI_MATERIAL_CHUNK_TARGET_CHARS",
  CHUNK_TARGET_DEFAULT,
);
let chunkMax = readPositiveIntEnv(
  "AI_MATERIAL_CHUNK_MAX_CHARS",
  CHUNK_MAX_DEFAULT,
);
if (chunkTarget > chunkMax) {
  const swap = chunkTarget;
  chunkTarget = chunkMax;
  chunkMax = swap;
}

export const DEFAULT_CHUNK_TARGET_CHARS = chunkTarget;
export const DEFAULT_CHUNK_MAX_CHARS = chunkMax;
export const DEFAULT_CHUNK_OVERLAP_CHARS = Math.min(
  readPositiveIntEnv(
    "AI_MATERIAL_CHUNK_OVERLAP_CHARS",
    CHUNK_OVERLAP_DEFAULT,
  ),
  Math.max(0, chunkMax - 1),
);
export const DEFAULT_CHUNK_MIN_CHARS = Math.min(
  readPositiveIntEnv("AI_MATERIAL_CHUNK_MIN_CHARS", CHUNK_MIN_DEFAULT),
  chunkTarget,
);

function splitIntoSentences(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (".!?。！？".includes(c)) {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j]!)) j++;
      const slice = text.slice(start, j).trim();
      if (slice) parts.push(slice);
      start = j;
      i = j;
      continue;
    }
    i++;
  }
  const tail = text.slice(start).trim();
  if (tail) parts.push(tail);
  return parts.filter(Boolean);
}

function splitFixedWindow(
  text: string,
  maxChars: number,
  overlapChars: number,
): string[] {
  const t = text.trim();
  if (!t.length) return [];
  if (t.length <= maxChars) return [t];

  const out: string[] = [];
  let start = 0;
  const minStep = Math.max(1, maxChars - overlapChars);

  while (start < t.length) {
    let end = Math.min(start + maxChars, t.length);
    if (end < t.length) {
      const slice = t.slice(start, end);
      const searchStart = Math.max(0, slice.length - 400);
      let breakAt = -1;
      for (let k = slice.length - 1; k >= searchStart; k--) {
        if (/\s/.test(slice[k]!)) {
          breakAt = start + k + 1;
          break;
        }
      }
      if (breakAt > start + Math.floor(maxChars * 0.5)) {
        end = breakAt;
      }
    }
    const piece = t.slice(start, end).trim();
    if (piece) out.push(piece);
    if (end >= t.length) break;
    const nextStart = end - overlapChars;
    start = nextStart > start ? nextStart : start + minStep;
  }
  return out;
}

function packUnitsToChunks(
  units: string[],
  joiner: string,
  targetChars: number,
  maxChars: number,
  overlapChars: number,
): string[] {
  const out: string[] = [];
  let current = "";

  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) out.push(trimmed);
    current = "";
  };

  for (const uRaw of units) {
    const u = uRaw.trim();
    if (!u) continue;

    if (u.length > maxChars) {
      flush();
      out.push(
        ...splitOversizedBlock(u, targetChars, maxChars, overlapChars),
      );
      continue;
    }

    const candidate = current ? current + joiner + u : u;
    if (!current) {
      current = u;
      continue;
    }
    if (candidate.length <= targetChars) {
      current = candidate;
    } else {
      flush();
      current = u;
    }
  }
  flush();
  return out;
}

function splitOversizedBlock(
  block: string,
  targetChars: number,
  maxChars: number,
  overlapChars: number,
): string[] {
  const b = block.trim();
  if (!b.length) return [];
  if (b.length <= maxChars) return [b];

  const lines = b.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const packed = packUnitsToChunks(
      lines,
      "\n",
      targetChars,
      maxChars,
      overlapChars,
    );
    const out: string[] = [];
    for (const piece of packed) {
      if (piece.length > maxChars) {
        out.push(
          ...splitOversizedBlock(
            piece,
            targetChars,
            maxChars,
            overlapChars,
          ),
        );
      } else {
        out.push(piece);
      }
    }
    return out;
  }

  const sentences = splitIntoSentences(b);
  if (sentences.length > 1) {
    const packed = packUnitsToChunks(
      sentences,
      " ",
      targetChars,
      maxChars,
      overlapChars,
    );
    const out: string[] = [];
    for (const piece of packed) {
      if (piece.length > maxChars) {
        out.push(
          ...splitOversizedBlock(
            piece,
            targetChars,
            maxChars,
            overlapChars,
          ),
        );
      } else {
        out.push(piece);
      }
    }
    return out;
  }

  return splitFixedWindow(b, maxChars, overlapChars);
}

function mergeSmallChunks(
  chunks: string[],
  minChars: number,
  maxChars: number,
): string[] {
  const work = chunks.map((c) => c.trim()).filter((c) => c.length > 0);
  if (work.length === 0) return [];

  let i = 0;
  while (i < work.length) {
    const cur = work[i]!;
    if (cur.length >= minChars || work.length === 1) {
      i++;
      continue;
    }

    const isLast = i === work.length - 1;

    if (i > 0) {
      const prev = work[i - 1]!;
      const merged = `${prev}\n\n${cur}`;
      if (merged.length <= maxChars || isLast) {
        work[i - 1] = merged;
        work.splice(i, 1);
        continue;
      }
      if (!isLast) {
        const next = work[i + 1]!;
        work[i + 1] = `${cur}\n\n${next}`;
        work.splice(i, 1);
        continue;
      }
    }

    if (i === 0 && work.length > 1) {
      const next = work[1]!;
      work[1] = `${cur}\n\n${next}`;
      work.splice(0, 1);
      continue;
    }

    i++;
  }
  return work;
}

/**
 * Split cleaned material into paragraph-first chunks for LLM quiz generation.
 * Overlap applies only when splitting oversized runs via fixed windows.
 */
export function chunkMaterialText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized.length) {
    throw new Error("Could not chunk material: cleaned text is empty.");
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const rawChunks: string[] = [];
  let current = "";

  const flushCurrent = () => {
    const t = current.trim();
    if (t) rawChunks.push(t);
    current = "";
  };

  for (const p of paragraphs) {
    if (p.length > DEFAULT_CHUNK_MAX_CHARS) {
      flushCurrent();
      rawChunks.push(
        ...splitOversizedBlock(
          p,
          DEFAULT_CHUNK_TARGET_CHARS,
          DEFAULT_CHUNK_MAX_CHARS,
          DEFAULT_CHUNK_OVERLAP_CHARS,
        ),
      );
      continue;
    }

    if (!current) {
      current = p;
      continue;
    }

    const candidate = `${current}\n\n${p}`;
    if (candidate.length <= DEFAULT_CHUNK_TARGET_CHARS) {
      current = candidate;
    } else {
      flushCurrent();
      current = p;
    }
  }
  flushCurrent();

  if (rawChunks.length === 0) {
    throw new Error("Could not chunk material: no chunks produced.");
  }

  return mergeSmallChunks(
    rawChunks,
    DEFAULT_CHUNK_MIN_CHARS,
    DEFAULT_CHUNK_MAX_CHARS,
  );
}

export async function extractPlainTextFromUpload(options: {
  buffer: Buffer;
  mimeType: AllowedMime;
}): Promise<string> {
  const { buffer, mimeType } = options;
  if (mimeType === "text/plain") {
    return decodeTxtBuffer(buffer);
  }

  const data = new Uint8Array(buffer);
  let pages: string[] = [];

  try {
    pages = await extractPdfWithStructuredItems(data);
  } catch {
    pages = [];
  }

  const nonEmpty = pages.filter((p) => p && p.replace(/--- Page \d+ ---\s*/g, "").trim());
  if (nonEmpty.length === 0) {
    try {
      pages = await extractPdfWithHighLevelExtractText(data);
    } catch {
      pages = [];
    }
  }

  if (!pages.length || !pages.some((p) => p.trim())) {
    throw new Error(
      "Could not extract readable text from this PDF. It may be scanned or image-only.",
    );
  }

  return pages.filter((p) => p.length > 0).join("\n\n");
}
