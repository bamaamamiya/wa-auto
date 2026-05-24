// ollamaClient.js
import dotenv from "dotenv";
import { validateReply } from "./validator.js";

dotenv.config();

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:1b";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 60000;
const FALLBACK_REPLY = "Maaf kak, mohon tunggu sebentar ya 🙏";
const MAX_RETRY = 1;

export const requestOllama = async (messages, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  const model = options.model || OLLAMA_MODEL;
  const startedAt = Date.now();

  const MAX_CHARS = 3000;
  const safeMessages = messages.map((m) => ({
    ...m,
    content: String(m.content).slice(0, MAX_CHARS),
  }));

  console.log("\n========== OLLAMA INPUT ==========");

  safeMessages.forEach((m, i) => {
    console.log(`\n[${i}] ROLE: ${m.role}`);
    console.log(m.content);
  });

  console.log("\n==================================\n");

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
          num_predict: options.num_predict ?? 80,
          seed: options.seed ?? 42,
          repeat_penalty: options.repeat_penalty ?? 1.15,
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

    console.log("\n========== OLLAMA OUTPUT ==========");
    console.log(content);
    console.log("===================================\n");

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

    if (err.name === "AbortError") return null;

    throw err;
  } finally {
    clearTimeout(timeout);
  }
};

export const chatWithOllama = async (messages, options = {}) => {
  let attempt = 0;
  let lastReply = null;
  let lastErrors = [];

  while (attempt <= MAX_RETRY) {
    attempt++;

    console.log(`[Ollama] Attempt ${attempt}/${MAX_RETRY + 1}`);

    const reply = await requestOllama(messages, options);

    if (!reply) {
      console.log("[Validator] Reply null, skip validate");
      lastErrors = ["empty"];
      break;
    }

    const { valid, errors } = validateReply(reply);

    console.log("[Validator] Result", { valid, errors, attempt });

    if (valid) {
      return reply;
    }

    lastReply = reply;
    lastErrors = errors;

    if (attempt <= MAX_RETRY) {
      console.log("[Ollama] Retrying due to:", errors);
    }
  }

  console.log("[Ollama] All attempts failed, using fallback", {
    lastErrors,
    lastReply: lastReply?.slice(0, 100),
  });

  return FALLBACK_REPLY;
};
