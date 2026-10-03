const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_TOKENS = 4096;

// Ordered fallback chain; the first provider/model that answers wins.
const GROQ_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"];
const OPENROUTER_MODELS = ["nvidia/nemotron-3-super-120b-a12b:free", "google/gemma-4-31b-it:free", "nvidia/nemotron-3.5-lightning:free", "google/gemma-4-26b-a4b-it:free", "openrouter/free"];

export class AiUnavailableError extends Error {
  constructor(message = "AI chat is unavailable right now") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

type Attempt = { name: string; url: string; apiKey: string; model: string; extraHeaders?: Record<string, string> };

const buildAttempts = (): Attempt[] => {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  const attempts: Attempt[] = [];

  if (groqKey) {
    for (const model of GROQ_MODELS) attempts.push({ name: `groq:${model}`, url: GROQ_URL, apiKey: groqKey, model });
  }

  if (openRouterKey) {
    for (const model of OPENROUTER_MODELS) {
      attempts.push({
        name: `openrouter:${model}`,
        url: OPENROUTER_URL,
        apiKey: openRouterKey,
        model,
        extraHeaders: { "HTTP-Referer": process.env.CLIENT_APP_URL ?? "https://hayadrivers.com", "X-Title": "Haya Drivers" },
      });
    }
  }

  return attempts;
};

const messageText = (message: unknown): string => {
  const record = (message ?? {}) as { content?: unknown; reasoning?: unknown };
  if (typeof record.content === "string" && record.content.trim()) return record.content;
  if (Array.isArray(record.content)) {
    const joined = record.content.map(part => (typeof part === "string" ? part : ((part as { text?: string })?.text ?? ""))).join("");
    if (joined.trim()) return joined;
  }
  return typeof record.reasoning === "string" ? record.reasoning : "";
};

const attemptCompletion = async (attempt: Attempt, systemPrompt: string, history: ChatTurn[]): Promise<string> => {
  const body: Record<string, unknown> = {
    model: attempt.model,
    messages: [{ role: "system", content: systemPrompt }, ...history],
    temperature: 0.2,
  };

  if (attempt.url === GROQ_URL) {
    body.reasoning_effort = "low";
    body.include_reasoning = false;
    body.max_completion_tokens = MAX_OUTPUT_TOKENS;
  } else {
    body.max_tokens = MAX_OUTPUT_TOKENS;
  }

  const response = await fetch(attempt.url, {
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { Authorization: `Bearer ${attempt.apiKey}`, "Content-Type": "application/json", ...(attempt.extraHeaders ?? {}) },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`${attempt.name} responded ${response.status}`);

  const data = (await response.json()) as { choices?: { message?: unknown }[] };
  const text = messageText(data.choices?.[0]?.message).trim();
  if (!text) throw new Error(`${attempt.name} returned an empty response`);
  return text;
};

export const generateText = async function (history: ChatTurn[], systemPrompt: string): Promise<{ text: string; model: string }> {
  const attempts = buildAttempts();
  if (!attempts.length) throw new AiUnavailableError("Set GROQ_API_KEY or OPENROUTER_API_KEY to enable AI chat");

  const failures: string[] = [];

  for (const attempt of attempts) {
    try {
      const text = await attemptCompletion(attempt, systemPrompt, history);
      return { text, model: attempt.model };
    } catch (error) {
      failures.push(`${attempt.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.error("[ai] all providers failed:", failures.join(" | "));
  throw new AiUnavailableError();
};
