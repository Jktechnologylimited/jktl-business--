import "server-only";

/**
 * DeepSeek client — the cognitive layer of the intercept pipeline.
 *
 * DeepSeek's API is OpenAI-shaped, so this is a small fetch wrapper plus one
 * important piece of accounting: DeepSeek reports how many prompt tokens
 * were served from its context cache (`prompt_cache_hit_tokens`), and those
 * bill at roughly a quarter of the full input rate. That single number is
 * what turns "an AI receptionist" into a business with a 95% gross margin,
 * because a booking conversation re-sends the same system prompt — business
 * hours, service list, triage rules — on every one of its dozen or so turns.
 * So usage is captured in three buckets, not one, and the cost calculation
 * in `src/lib/ai/pricing.ts` consumes all three.
 *
 * Everything here degrades honestly: if `DEEPSEEK_API_KEY` is unset or the
 * API is down, `chatComplete` returns `ok: false` and the caller falls back
 * to the deterministic engine in `src/lib/ai/fallback-engine.ts`. The chat
 * still books appointments without a model; it just can't improvise.
 */

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const REQUEST_TIMEOUT_MS = 30_000;

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Present on assistant messages that requested tools. */
  tool_calls?: ToolCall[];
  /** Present on tool results, linking them to the request. */
  tool_call_id?: string;
  name?: string;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface TokenBuckets {
  /** Prompt tokens billed at the full input rate (DeepSeek's cache misses). */
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export type ChatResult =
  | {
      ok: true;
      content: string;
      toolCalls: ToolCall[];
      usage: TokenBuckets;
      model: string;
      finishReason: string;
      /** Milliseconds the provider took — surfaced in the console because a
       * slow turn is the difference between a patient waiting and leaving. */
      latencyMs: number;
    }
  | { ok: false; error: string; retryable: boolean };

export function isDeepSeekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

/**
 * Model name. Defaults to `deepseek-chat`; set `DEEPSEEK_MODEL` to a
 * Flash-tier or newer model name as accounts gain access to them — the
 * blueprint's cost claims are computed from the token prices in
 * `src/lib/ai/pricing.ts`, which should be reviewed whenever this changes.
 */
export function deepseekModel(): string {
  return process.env.DEEPSEEK_MODEL || "deepseek-chat";
}

function baseUrl(): string {
  return (process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export interface ChatCompletionInput {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  /** "auto" lets the model decide; "none" forbids tool use for this turn. */
  toolChoice?: "auto" | "none";
  temperature?: number;
  maxTokens?: number;
  /** Ask for a JSON object back — used by the session summariser. */
  jsonMode?: boolean;
}

interface DeepSeekResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | null; tool_calls?: ToolCall[] };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
  error?: { message?: string; type?: string };
}

/** One completion. Never throws for provider or network failures — returns
 * `ok: false` with a `retryable` hint so the engine can decide between
 * retrying once and falling back immediately. */
export async function chatComplete(input: ChatCompletionInput): Promise<ChatResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { ok: false, error: "DEEPSEEK_API_KEY is not configured.", retryable: false };

  const model = deepseekModel();
  const body: Record<string, unknown> = {
    model,
    messages: input.messages,
    stream: false,
    temperature: input.temperature ?? 0.3,
    max_tokens: input.maxTokens ?? 700,
  };
  if (input.tools?.length) {
    body.tools = input.tools;
    body.tool_choice = input.toolChoice ?? "auto";
  }
  if (input.jsonMode) body.response_format = { type: "json_object" };

  const startedAt = Date.now();
  try {
    const res = await fetch(`${baseUrl()}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    let data: DeepSeekResponse = {};
    try {
      data = (await res.json()) as DeepSeekResponse;
    } catch {
      // Fall through to the status check.
    }

    if (!res.ok) {
      const message = data.error?.message || `DeepSeek returned ${res.status}`;
      // 429 and 5xx are worth one retry; a 400 (bad request, bad model name)
      // will fail identically forever.
      const retryable = res.status === 429 || res.status >= 500;
      return { ok: false, error: message, retryable };
    }

    const choice = data.choices?.[0];
    if (!choice) return { ok: false, error: "DeepSeek returned no choices.", retryable: true };

    // Usage fields are optional in the schema; treat a missing usage block as
    // zero tokens rather than failing the turn — a reply we can't fully
    // account for is still better than no reply, and the console's cost
    // report will show the gap.
    const usage = data.usage ?? {};
    const cachedInputTokens = Number(usage.prompt_cache_hit_tokens ?? 0);
    const totalPrompt = Number(usage.prompt_tokens ?? 0);
    const inputTokens =
      usage.prompt_cache_miss_tokens !== undefined
        ? Number(usage.prompt_cache_miss_tokens)
        : Math.max(0, totalPrompt - cachedInputTokens);

    return {
      ok: true,
      content: (choice.message?.content ?? "").trim(),
      toolCalls: choice.message?.tool_calls ?? [],
      usage: {
        inputTokens,
        cachedInputTokens,
        outputTokens: Number(usage.completion_tokens ?? 0),
      },
      model: data.model || model,
      finishReason: choice.finish_reason ?? "stop",
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    const aborted = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return {
      ok: false,
      error: aborted ? "DeepSeek request timed out." : err instanceof Error ? err.message : "DeepSeek request failed.",
      retryable: true,
    };
  }
}
