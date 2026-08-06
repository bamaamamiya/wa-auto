// src/bot/whatsappBot.js
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
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

  const { state, saveCreds } = await useMultiFileAuthState("./.session");

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: !usePairingCode,
  });

  globalSock = sock;

  console.log("🔌 Socket created");

  console.log("========== EVENT EMITTER ==========");
  console.log("off:", typeof sock.ev.off);
  console.log("removeListener:", typeof sock.ev.removeListener);
  console.log("removeAllListeners:", typeof sock.ev.removeAllListeners);
  console.log("on:", typeof sock.ev.on);
  console.log("==================================");

  // 🔐 Pairing
  if (usePairingCode && !sock.authState.creds.registered) {
    console.log("🔑 Device belum terdaftar...");

    const phoneNumber = await question("Masukkan nomor (62xxx): ");
    const code = await sock.requestPairingCode(phoneNumber.trim());

    console.log("🔐 Pairing Code:", code);
  }

  // 💾 Save session
  sock.ev.on("creds.update", saveCreds);

  return sock;
}
