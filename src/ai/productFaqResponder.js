import { chatWithOllama } from "./ollamaClient.js";
import { buildFaqSystemPrompt } from "./faqPrompt.js";
import {
  GENERAL_FACTS,
  GREETING_REPLY,
  INTENT_GROUPS,
  ORDER_KEYWORDS,
  OUT_OF_SCOPE_REPLY,
  STOP_WORDS,
} from "./faqConfig.js";

const formatMoney = (value) => {
  const number = Number(value) || 0;
  if (!number) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(number);
};

const normalizeText = (value) => {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const tokenize = (value) => {
  return normalizeText(value)
    .split(" ")
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
};

const JAVA_PROVINCES = new Set([
  "banten",
  "daerah istimewa yogyakarta",
  "di yogyakarta",
  "diy",
  "dki jakarta",
  "jakarta",
  "jawa barat",
  "jawa tengah",
  "jawa timur",
  "yogyakarta",
]);

const getLeadProvince = (lead) => {
  return (
    lead.province ||
    lead.provinsi ||
    lead.shippingProvince ||
    lead.address?.province ||
    lead.destination?.province ||
    ""
  );
};

const getShippingRegion = (lead) => {
  const province = normalizeText(getLeadProvince(lead));
  if (!province) return null;

  return JAVA_PROVINCES.has(province) ? "jawa" : "luar_jawa";
};

const getPaymentMethod = (lead) => {
  return (
    lead.paymentMethod ||
    lead.payment_method ||
    lead.payment?.method ||
    lead.order?.paymentMethod ||
    ""
  );
};

const isGreeting = (question) => {
  const normalized = normalizeText(question)
    .replace(/\b(kak|ka|gan|sis)\b$/u, "")
    .trim();

  return [
    "halo",
    "hallo",
    "hello",
    "hai",
    "hi",
    "pagi",
    "siang",
    "sore",
    "malam",
    "assalamualaikum",
    "permisi",
  ].includes(normalized);
};

const buildLeadContext = (lead) => {
  const province = getLeadProvince(lead);
  const shippingRegion = getShippingRegion(lead);

  const context = [
    `Nama customer: ${lead.name || "-"}`,
    `Product ID: ${lead.product_id || lead.productId || "-"}`,
    `Produk order: ${lead.productTitle || "-"}`,
    `Harga order: ${formatMoney(lead.price)}`,
    `Ongkir order: ${formatMoney(lead.ongkir)}`,
    `Metode pembayaran order: ${getPaymentMethod(lead) || "-"}`,
    `Provinsi order: ${province || "-"}`,
    `Region shipping order: ${shippingRegion || "-"}`,
    `Alamat order: ${lead.addressClean || "-"}`,
    `Status order: ${lead.state || "-"}`,
  ];

  if (Array.isArray(lead.upsells) && lead.upsells.length > 0) {
    const upsells = lead.upsells
      .map(
        (item) =>
          `${item.code || item.name || "Upsell"} ${formatMoney(item.price)}`,
      )
      .join(", ");

    context.push(`Pilihan tambahan order: ${upsells}`);
  }

  return context.join("\n");
};

const formatPrimitive = (value) => {
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "ya" : "tidak";
  return String(value);
};

const flattenKnowledge = (value, path = "") => {
  if (value === null || value === undefined || value === "") return [];

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      const label =
        item?.name ||
        item?.variant ||
        item?.intent?.join?.("_") ||
        item?.case ||
        item?.user_says ||
        index;

      return flattenKnowledge(item, `${path}.${label}`.replace(/^\./, ""));
    });
  }

  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => {
      return flattenKnowledge(item, `${path}.${key}`.replace(/^\./, ""));
    });
  }

  return [
    {
      path,
      value: formatPrimitive(value),
      text: `${path}: ${formatPrimitive(value)}`,
    },
  ];
};

const findArrayItemByKey = (items, key) => {
  const normalizedKey = normalizeText(key);

  return items.find((item) => {
    return [
      item?.name,
      item?.variant,
      item?.code,
      item?.case,
      item?.user_says,
      ...(Array.isArray(item?.intent) ? item.intent : []),
    ].some((value) => normalizeText(value) === normalizedKey);
  });
};

const getByPath = (source, path) => {
  return path.split(".").reduce((current, key) => {
    if (!current) return null;
    if (Array.isArray(current)) return findArrayItemByKey(current, key) || null;
    return current[key] ?? null;
  }, source);
};

const formatKnowledgeValue = (value) => {
  if (value === null || value === undefined || value === "") return "";

  if (Array.isArray(value)) {
    return value.map(formatKnowledgeValue).filter(Boolean).join(" | ");
  }

  if (typeof value !== "object") {
    return formatPrimitive(value);
  }

  return Object.entries(value)
    .map(([key, item]) => `${key}: ${formatKnowledgeValue(item)}`)
    .filter((line) => !line.endsWith(": "))
    .join(", ");
};

const addFact = (facts, label, value) => {
  const formatted = formatKnowledgeValue(value);
  if (!formatted) return;
  facts.push(`${label}: ${formatted}`);
};

const getOrderFactValue = (lead, path) => {
  const key = path.replace("order.", "");

  if (key === "price") return formatMoney(lead.price);
  if (key === "ongkir") return formatMoney(lead.ongkir);
  if (key === "product_id") return lead.product_id || lead.productId;
  if (key === "paymentMethod") return getPaymentMethod(lead);
  if (key === "province") return getLeadProvince(lead);
  if (key === "shipping_region") return getShippingRegion(lead);

  return lead[key] ?? null;
};

const addFactByPath = ({ facts, lead, product, path }) => {
  if (path.startsWith("order.")) {
    addFact(facts, path, getOrderFactValue(lead, path));
    return;
  }

  if (path.startsWith("general.")) {
    addFact(facts, path, getByPath(GENERAL_FACTS, path.replace("general.", "")));
    return;
  }

  if (path === "shipping.selected_region") {
    addFact(facts, path, getShippingRegion(lead));
    return;
  }

  if (path === "shipping.selected_estimation") {
    const region = getShippingRegion(lead);
    const estimation = region ? product?.shipping?.regions?.[region] : null;
    addFact(facts, path, estimation);
    return;
  }

  addFact(facts, path, getByPath(product, path));
};

const includesPhraseOrToken = (question, phrase) => {
  const normalizedQuestion = normalizeText(question);
  const normalizedPhrase = normalizeText(phrase);

  if (!normalizedPhrase) return false;
  if (normalizedQuestion.includes(normalizedPhrase)) return true;

  const phraseTokens = tokenize(normalizedPhrase);
  if (phraseTokens.length === 0) return false;

  const questionTokens = new Set(tokenize(normalizedQuestion));
  return phraseTokens.every((token) => questionTokens.has(token));
};

const getFaqMatchedFacts = (product, question) => {
  const facts = [];
  const questionText = normalizeText(question);

  (product.faq || []).forEach((faq) => {
    const matched = (faq.intent || []).some((intent) => {
      return questionText.includes(normalizeText(intent));
    });

    if (!matched) return;

    (faq.retrieve || []).forEach((path) => {
      addFact(facts, path, getByPath(product, path));
    });
  });

  return facts;
};

const getIntentMatchedFacts = ({ lead, product, question }) => {
  if (!product) return [];

  const facts = [];

  INTENT_GROUPS.forEach((intent) => {
    const matched = intent.keywords.some((keyword) => {
      return includesPhraseOrToken(question, keyword);
    });

    if (!matched) return;

    intent.paths.forEach((path) => {
      addFactByPath({ facts, lead, product, path });
    });
  });

  return facts;
};

const getSearchMatchedFacts = (product, question) => {
  const questionTokens = new Set(tokenize(question));
  if (questionTokens.size === 0) return [];

  return flattenKnowledge(product)
    .map((fact) => {
      const factTokens = tokenize(`${fact.path} ${fact.value}`);
      const score = factTokens.reduce((total, token) => {
        return total + (questionTokens.has(token) ? 1 : 0);
      }, 0);

      return { ...fact, score };
    })
    .filter((fact) => fact.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 16)
    .map((fact) => fact.text);
};

const getOrderMatchedFacts = (lead, question) => {
  const facts = [];
  const questionTokens = new Set(tokenize(question));
  const hasOrderKeyword = ORDER_KEYWORDS.some((keyword) => {
    return normalizeText(question).includes(keyword);
  });

  const leadTokens = new Set(
    tokenize(
      [
        lead.product_id,
        lead.productId,
        lead.productTitle,
        getPaymentMethod(lead),
        getLeadProvince(lead),
        lead.addressClean,
        lead.state,
      ].join(" "),
    ),
  );

  const hasLeadToken = [...questionTokens].some((token) => {
    return leadTokens.has(token);
  });

  if (!hasOrderKeyword && !hasLeadToken) return facts;

  addFact(facts, "order.product_id", lead.product_id || lead.productId);
  addFact(facts, "order.productTitle", lead.productTitle);
  addFact(facts, "order.price", formatMoney(lead.price));
  addFact(facts, "order.ongkir", formatMoney(lead.ongkir));
  addFact(facts, "order.paymentMethod", getPaymentMethod(lead));
  addFact(facts, "order.province", getLeadProvince(lead));
  addFact(facts, "order.shipping_region", getShippingRegion(lead));
  addFact(facts, "order.addressClean", lead.addressClean);
  addFact(facts, "order.state", lead.state);

  return facts;
};

const buildRelevantFacts = ({ lead, product, question }) => {
  const orderFacts = getOrderMatchedFacts(lead, question);

  if (!product) {
    return {
      isRelated: orderFacts.length > 0,
      text:
        orderFacts.join("\n") ||
        "Product document tidak ditemukan dari product_id order.",
    };
  }

  const facts = [
    ...orderFacts,
    ...getFaqMatchedFacts(product, question),
    ...getIntentMatchedFacts({ lead, product, question }),
    ...getSearchMatchedFacts(product, question),
  ];

  if (facts.length === 0) return { isRelated: false, text: "" };

  return {
    isRelated: true,
    text: [...new Set(facts)].join("\n"),
  };
};

export const buildProductFaqReply = async ({ lead, product, question }) => {
  if (isGreeting(question)) {
    return GREETING_REPLY;
  }

  const relevantFacts = buildRelevantFacts({ lead, product, question });

  console.log("[FAQ] Database facts for AI", {
    hasProduct: !!product,
    isRelated: relevantFacts.isRelated,
    chars: relevantFacts.text.length,
    preview: relevantFacts.text.slice(0, 300),
  });

  if (!relevantFacts.isRelated) {
    return OUT_OF_SCOPE_REPLY;
  }

  const systemPrompt = buildFaqSystemPrompt();

  const userPrompt = `
DATA ORDER:
${buildLeadContext(lead)}

FAKTA DATABASE PRODUK:
${relevantFacts.text}

PERTANYAAN CUSTOMER:
${question}
`.trim();

  return chatWithOllama(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    {
      temperature: 0.1,
      numPredict: 140,
    },
  );
};
