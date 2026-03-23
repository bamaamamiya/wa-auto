import express from "express";

export function startServer(sock) {
  const app = express();

  app.use(express.json());

  app.post("/send", async (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: "phone dan message wajib" });
    }

    const chatId = phone + "@s.whatsapp.net";

    try {
      await sock.sendMessage(chatId, { text: message });

      res.json({ success: true });
    } catch (err) {
      console.error(err);

      res.status(500).json({ error: "gagal kirim pesan" });
    }
  });

  app.listen(8000, () => {
    console.log("API Test running di http://localhost:8000");
  });
}
