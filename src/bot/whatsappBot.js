// src/bot/whatsappBot.js
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import { setConnected } from "../state/connection.js";
import pino from "pino";
import readline from "readline";
import { handleIncomingMessage } from "./messageHandler.js";

const usePairingCode = true;

function question(text) {
  console.log("❓ Prompt input:", text);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(text, (answer) => {
      console.log("✍️ Input received:", answer);
      rl.close();
      resolve(answer);
    });
  });
}

export async function startWhatsApp() {
  console.log("🚀 Starting WhatsApp bot...");

  const { state, saveCreds } = await useMultiFileAuthState("./session");
  console.log("💾 Auth state loaded");

  const { version } = await fetchLatestBaileysVersion();
  console.log("📦 Baileys version:", version);

  const sock = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: !usePairingCode,
  });

  console.log("🔌 Socket created");

  // 🔐 Pairing
  if (usePairingCode && !sock.authState.creds.registered) {
    console.log("🔑 Device belum terdaftar, mulai pairing...");

    const phoneNumber = await question("Masukkan nomor (62xxx): ");
    console.log("📱 Nomor dimasukkan:", phoneNumber);

    const code = await sock.requestPairingCode(phoneNumber.trim());

    console.log("🔐 Pairing Code:", code);
  } else {
    console.log("✅ Sudah terdaftar, skip pairing");
  }

  // 💾 Save session
  sock.ev.on("creds.update", (creds) => {
    console.log("💾 Creds update triggered");
    saveCreds(creds);
  });

  // 🔥 Connection monitor (SUPER IMPORTANT)
  sock.ev.on("connection.update", (update) => {
    console.log("📡 Connection update raw:", update);

    const { connection, lastDisconnect } = update;

    if (connection === "connecting") {
      console.log("⏳ Connecting ke WhatsApp...");
    }

    if (connection === "open") {
      console.log("✅ WhatsApp Connected");
      setConnected(true);
    }

    if (connection === "close") {
      console.log("❌ WA Disconnect");
      setConnected(false);

      if (lastDisconnect?.error) {
        console.error("⚠️ Disconnect reason:");
        console.error(lastDisconnect.error);

        if (lastDisconnect.error?.output?.statusCode) {
          console.error(
            "📊 Status Code:",
            lastDisconnect.error.output.statusCode,
          );
        }
      }

      console.log("🔄 Menunggu reconnect otomatis...");
    }
  });

  // 📨 Message event listener (biar kamu lihat kalau ada message masuk)
  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages?.[0];
    if (!msg) return;

    await handleIncomingMessage(msg, sock);
  });

  // 💓 Heartbeat
  setInterval(() => {
    console.log("💓 WhatsApp bot masih hidup...");
  }, 30000);

  return sock;
}
