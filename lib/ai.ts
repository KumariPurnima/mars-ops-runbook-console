/**
 * Gradient Serverless Inference — one plain fetch, no SDK.
 * Base URL: https://inference.do-ai.run
 */
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatResult = {
  content: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
};

const BASE = 'https://inference.do-ai.run/v1';

export function inferenceConfigured(): boolean {
  return Boolean(process.env.DO_API_KEY) && process.env.FORCE_REPLAY !== '1';
}

export async function chatCompletions(
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number },
): Promise<ChatResult> {
  const key = process.env.DO_API_KEY;
  if (!key) {
    throw new Error('DO_API_KEY is not set — use replay mode or add a Model Access Key / PAT');
  }

  const model = opts?.model ?? process.env.INFERENCE_MODEL ?? 'openai-gpt-4.1';
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: opts?.temperature ?? 0.2,
      messages,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`inference ${res.status}: ${body.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  return {
    content: json.choices?.[0]?.message?.content ?? '',
    model: json.model ?? model,
    tokensIn: json.usage?.prompt_tokens ?? 0,
    tokensOut: json.usage?.completion_tokens ?? 0,
  };
}
