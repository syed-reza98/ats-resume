import OpenAI from "openai";

const NVIDIA_BASE_URL =
  process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL =
  process.env.NVIDIA_MODEL ?? "google/gemma-4-31b-it";

export function getNvidiaClient(): OpenAI {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not set");
  }

  return new OpenAI({
    baseURL: NVIDIA_BASE_URL,
    apiKey,
  });
}

/**
 * Gemma 4 may wrap answers in thought-channel tags even when thinking is off.
 * Strip those tags and extract the first JSON object from the response.
 */
export function parseModelJson<T>(raw: string): T {
  const withoutThought = raw
    .replace(/<\|channel\|>thought[\s\S]*?<\|channel\|>/g, "")
    .trim();

  const fenced = withoutThought.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? withoutThought;

  const jsonMatch = candidate.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Model response did not contain valid JSON");
  }

  return JSON.parse(jsonMatch[0]) as T;
}

export async function chatCompletionJson<T>(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
): Promise<T> {
  const client = getNvidiaClient();

  const response = await client.chat.completions.create({
    model: NVIDIA_MODEL,
    messages,
    response_format: { type: "json_object" },
    temperature: 1.0,
    top_p: 0.95,
  });

  const raw = response.choices[0]?.message?.content ?? "";
  if (!raw.trim()) {
    throw new Error("Model returned an empty response");
  }

  return parseModelJson<T>(raw);
}
