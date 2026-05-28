const CONFIRM_WORDS = [
  "iya",
  "ya",
  "y",
  "oke",
  "ok",
  "sip",
  "lanjut",
  "aman",
  "betul",
  "benar",
  "sesuai",
  "sudah benar",
  "sudah sesuai",
  "kirim",
  "gas",
];

const normalize = (text) => {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

export const hasConfirmIntent = (text) => {
  const t = normalize(text);

  return CONFIRM_WORDS.some((word) => {
    return t.includes(normalize(word));
  });
};