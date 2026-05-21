import dotenv from "dotenv";

dotenv.config();

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 30000;

export const chatWithOllama = async (messages, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  const model = options.model || OLLAMA_MODEL;
  const startedAt = Date.now();

  const MAX_CHARS = 6000;
  const safeMessages = messages.map((m) => ({
    ...m,
    content: String(m.content).slice(0, MAX_CHARS),
  }));

  try {
    console.log("[Ollama] Request started", {
      model,
      url: OLLAMA_URL,
      messages: safeMessages.length,
      chars: safeMessages.reduce((a, m) => a + m.content.length, 0),
      timeoutMs: OLLAMA_TIMEOUT_MS,
    });

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: safeMessages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.15,
          num_predict: options.numPredict ?? 120,
          seed: options.seed ?? 42,
          repeat_penalty: options.repeatPenalty ?? 1.15,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Ollama error ${response.status}: ${body}`);
    }

    const data = await response.json();
    const content = data.message?.content?.trim() || "";

    console.log("[Ollama] Reply received", {
      model,
      durationMs: Date.now() - startedAt,
      responseChars: content.length,
    });

    return content;
  } catch (err) {
    console.error("[Ollama] Request failed", {
      model,
      durationMs: Date.now() - startedAt,
      message: err.message,
    });

    throw err;
  } finally {
    clearTimeout(timeout);
  }
};
