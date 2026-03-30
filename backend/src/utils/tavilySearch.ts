import dotenv from "dotenv";
import { logExplain } from "./ai-explain-log.js";

dotenv.config({ path: ".env.local" });

const TAVILY_API = "https://api.tavily.com/search";

export type WebSearchHit = {
  title: string;
  url: string;
  snippet: string;
};

/**
 * Live web search via Tavily (https://tavily.com). Returns [] if TAVILY_API_KEY
 * is unset or on failure — callers should fall back to model-only reasoning.
 */
export async function searchWebForQuestion(
  questionText: string
): Promise<WebSearchHit[]> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) {
    logExplain("Tavily: skipped (TAVILY_API_KEY not set)");
    return [];
  }

  const query = questionText.trim().slice(0, 1000);
  if (!query) {
    logExplain("Tavily: skipped (empty question text)");
    return [];
  }

  logExplain("Tavily: request", { query, queryLength: query.length });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(TAVILY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 3,
        search_depth: "basic",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      logExplain(`Tavily: HTTP ${res.status}`, text.slice(0, 400));
      console.error("Tavily search failed:", res.status, text.slice(0, 300));
      return [];
    }

    const data = (await res.json()) as {
      results?: { title?: string; url?: string; content?: string }[];
    };

    const hits: WebSearchHit[] = [];
    for (const r of data.results ?? []) {
      const url = (r.url ?? "").trim();
      if (!url) continue;
      hits.push({
        title: (r.title ?? "Result").trim() || "Result",
        url,
        snippet: (r.content ?? "").trim().slice(0, 600),
      });
      if (hits.length >= 5) break;
    }

    logExplain("Tavily: results", {
      count: hits.length,
      urls: hits.map((h) => h.url),
    });

    return hits;
  } catch (e) {
    console.error("Tavily search error:", e);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
