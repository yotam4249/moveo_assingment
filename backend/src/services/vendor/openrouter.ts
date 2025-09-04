// src/services/vendor/openrouter.ts
import axios from "axios";

const BASE = process.env.OPENROUTER_BASE || "https://openrouter.ai/api/v1";
const API_KEY = process.env.OPENROUTER_API_KEY || "";
const SITE_URL = process.env.SITE_URL || "http://localhost:3000";
const APP_NAME = process.env.APP_NAME || "Crypto Advisor";

if (!API_KEY) {
  console.warn("[openrouter] OPENROUTER_API_KEY missing – will skip calls and fallback");
}

/** Prefer free models; rotate on errors/rate limits */
const FREE_MODELS = [
  // keep the :free suffix so we don't get billed
  "meta-llama/llama-3.1-8b-instruct:free",
  "qwen/qwen-2.5-7b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
  // add/remove as you like based on availability
];

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

async function chatOnce(model: string, messages: ChatMsg[], abortMs = 15000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), abortMs);

  try {
    const { data } = await axios.post(
      `${BASE}/chat/completions`,
      {
        model,
        messages,
        temperature: 0.4,
        max_tokens: 300,
      },
      {
        signal: ctrl.signal,
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "HTTP-Referer": SITE_URL,
          "X-Title": APP_NAME,
          "Content-Type": "application/json",
        },
        timeout: abortMs + 1000,
      }
    );
    const txt: string = data?.choices?.[0]?.message?.content || "";
    return (txt || "").trim();
  } finally {
    clearTimeout(t);
  }
}

/** Try each free model until one works; return empty string on total failure. */
export async function chatFree(messages: ChatMsg[]): Promise<string> {
  if (!API_KEY) return "";
  let lastErr: any = null;
  for (const m of FREE_MODELS) {
    try {
      const out = await chatOnce(m, messages);
      if (out) return out;
    } catch (e: any) {
      lastErr = e;
      // 429/5xx -> try next model
    }
  }
  console.warn("[openrouter] all free models failed:", lastErr?.message || lastErr);
  return "";
}
