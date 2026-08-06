import express from "express";
import { getSock } from "./bot/whatsappBot.js";
import { isConnected } from "./states/connection.js";
import { log } from "./utils/logger.js";

const PORT = process.env.PORT || 8000;
const start = Date.now();

export function startServer() {
  const app = express();

  app.use(express.json());

  app.post("/send", async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({
        error: "phone dan message wajib",
      });
    }

    const sock = getSock();

    if (!sock || !isConnected()) {
      return res.status(503).json({
        error: "WhatsApp belum connect",
      });
    }

    // 👇 Log request masuk
    log.server(`POST /send -> ${phone}`);

    try {
      log.server(`POST /send -> ${phone}`);

      await sock.sendMessage(`${phone}@s.whatsapp.net`, { text: message });

      log.success(`Message sent -> ${phone} (${Date.now() - start}ms)`);

      res.json({
        success: true,
      });
    } catch (err) {
      log.error(`Failed sending -> ${phone} (${Date.now() - start}ms)`, err);

      res.status(500).json({
        error: "gagal kirim pesan",
      });
    }
  });

  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      whatsapp: isConnected(),
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage().rss,
    });
  });

  const server = app.listen(PORT, () => {
    log.server("Listening on port 8000");
  });
  return server;
}
