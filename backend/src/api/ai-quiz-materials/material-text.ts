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

/** `--- Page N ---` glued to following text on same line → force newline after marker. */
function ensurePageMarkersOnOwnLine(text: string): string {
  return text.replace(/(--- Page \d+ ---)(?=[^\r\n\s])/g, "$1\n");
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
