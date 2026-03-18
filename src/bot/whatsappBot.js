import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";

import pino from "pino";
import readline from "readline";

const usePairingCode = true;

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
  const { state, saveCreds } = await useMultiFileAuthState("./session");

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: !usePairingCode,
  });

  if (usePairingCode && !sock.authState.creds.registered) {
    const phoneNumber = await question("Masukkan nomor (62xxx): ");

    const code = await sock.requestPairingCode(phoneNumber.trim());

    console.log("Pairing Code:", code);
  }

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection } = update;

    if (connection === "open") {
      console.log("WhatsApp Connected");
    }

    if (connection === "close") {
      console.log("Reconnecting in 5 seconds...");
      setTimeout(() => {
        startWhatsApp();
      }, 5000);
    }
  });

  return sock;
}
