// src/bot/whatsappBot.js
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import { setConnected } from "../states/connection.js";
import pino from "pino";
import readline from "readline";

const usePairingCode = true;

let globalSock = null;

export function getSock() {
  return globalSock;
}

function question(text) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(text, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export async function startWhatsApp() {
  console.log("🚀 Starting WhatsApp bot...");

  // 🔥 CLOSE OLD SOCKET
  if (globalSock) {
    console.log("♻️ Closing old socket...");
    try {
      globalSock.end?.();
    } catch {}
  }

  const { state, saveCreds } = await useMultiFileAuthState("./session");

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: !usePairingCode,
  });

  globalSock = sock;

  console.log("🔌 Socket created");

  // 🔐 Pairing
  if (usePairingCode && !sock.authState.creds.registered) {
    console.log("🔑 Device belum terdaftar...");

    const phoneNumber = await question("Masukkan nomor (62xxx): ");
    const code = await sock.requestPairingCode(phoneNumber.trim());

    console.log("🔐 Pairing Code:", code);
  }

  // 💾 Save session
  sock.ev.on("creds.update", saveCreds);

  // 🔥 CONNECTION HANDLER
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("✅ WhatsApp Connected");
      setConnected(true);
    }

    if (connection === "close") {
      console.log("❌ WA Disconnect");
      setConnected(false);

      if (lastDisconnect?.error) {
        console.error("⚠️", lastDisconnect.error?.output?.statusCode);
      }

      console.log("🔄 Reconnecting in 5 seconds...");

      setTimeout(() => {
        startWhatsApp();
      }, 5000);
    }
  });

  return sock;
}