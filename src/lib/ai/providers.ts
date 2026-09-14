/**
 * Provider adapters for the site-edit agent.
 * Keys stay server-side only. OpenAI-compatible covers openai + xAI (+ many proxies).
 */

export type AiChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AiProviderId = "openai" | "anthropic" | "google" | "xai";

export type AiCompletionResult = {
  text: string;
  tokensIn?: number;
  tokensOut?: number;
};

export interface AiProviderAdapter {
  id: AiProviderId;
  complete(opts: {
    apiKey: string;
    model: string;
    messages: AiChatMessage[];
    maxTokens: number;
  }): Promise<AiCompletionResult>;
}

async function openaiCompatibleComplete(
  baseUrl: string,
  opts: { apiKey: string; model: string; messages: AiChatMessage[]; maxTokens: number }
): Promise<AiCompletionResult> {
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      max_tokens: opts.maxTokens,
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Provider error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content || "";
  return {
    text,
    tokensIn: data.usage?.prompt_tokens,
    tokensOut: data.usage?.completion_tokens,
  };
}

export const openaiAdapter: AiProviderAdapter = {
  id: "openai",
  complete: (opts) => openaiCompatibleComplete("https://api.openai.com/v1", opts),
};

export const xaiAdapter: AiProviderAdapter = {
  id: "xai",
  complete: (opts) => openaiCompatibleComplete("https://api.x.ai/v1", opts),
};

export const anthropicAdapter: AiProviderAdapter = {
  id: "anthropic",
  async complete(opts) {
    const system = opts.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const msgs = opts.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": opts.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens,
        system: system || undefined,
        messages: msgs.length ? msgs : [{ role: "user", content: "ping" }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic error ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text = (data.content || [])
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text!)
      .join("\n");
    return {
      text,
      tokensIn: data.usage?.input_tokens,
      tokensOut: data.usage?.output_tokens,
    };
  },
};

/** Google Gemini stub via Generative Language API (OpenAI-like when key present). */
export const googleAdapter: AiProviderAdapter = {
  id: "google",
  async complete(opts) {
    const model = opts.model || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;
    const contents = opts.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
    const system = opts.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        generationConfig: { maxOutputTokens: opts.maxTokens, temperature: 0.2 },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Google error ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    return {
      text,
      tokensIn: data.usageMetadata?.promptTokenCount,
      tokensOut: data.usageMetadata?.candidatesTokenCount,
    };
  },
};

export function getProviderAdapter(id: AiProviderId): AiProviderAdapter {
  switch (id) {
    case "anthropic":
      return anthropicAdapter;
    case "google":
      return googleAdapter;
    case "xai":
      return xaiAdapter;
    case "openai":
    default:
      return openaiAdapter;
  }
}
