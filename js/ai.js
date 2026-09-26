// Receipt scanning and recipe import.
// - With a Claude API key (Settings), receipts and recipe links are read by Claude.
// - Without one, receipts are read with Tesseract OCR in the browser (free, less accurate).
import { CATEGORY_IDS } from "./foods.js";

const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm";
const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js";
const MODEL = "claude-opus-5";
const KEY_STORAGE = "kitchen-anthropic-key";

export const getApiKey = () => { try { return localStorage.getItem(KEY_STORAGE) || ""; } catch { return ""; } };
export const setApiKey = (k) => { try { k ? localStorage.setItem(KEY_STORAGE, k) : localStorage.removeItem(KEY_STORAGE); } catch {} };

let clientPromise = null;
let clientKey = null;
async function getClient() {
  const key = getApiKey();
  if (!clientPromise || clientKey !== key) {
    clientKey = key;
    clientPromise = import(SDK_URL).then(({ default: Anthropic }) =>
      new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }));
  }
  return clientPromise;
}

// One request with structured JSON output. Refusals fall back to another model server-side.
async function askClaude({ content, schema, tools }) {
  const client = await getClient();
  const messages = [{ role: "user", content }];
  for (let turn = 0; turn < 4; turn++) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema } },
      ...(tools ? { tools } : {}),
      messages,
    });
    if (res.stop_reason === "refusal") throw new Error("Claude declined to read this. Try again or enter it manually.");
    if (res.stop_reason === "pause_turn") {
      // Server tool (web fetch) still running — send the partial turn back to let it continue.
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    if (res.stop_reason === "max_tokens") throw new Error("Response was cut off. Try a clearer photo.");
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return JSON.parse(text);
  }
  throw new Error("Took too long. Please try again.");
}

// ---------- images ----------

// Downscale a photo to a JPEG data URL (keeps uploads and stored photos small).
export function resizeImage(file, maxSide = 1000, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't open that image.")); };
    img.src = url;
  });
}

// ---------- receipts ----------

const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: { type: "integer" },
          category: { type: "string", enum: CATEGORY_IDS },
        },
        required: ["name", "quantity", "category"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

const RECEIPT_PROMPT = `This is a photo of a grocery store receipt. List every product that was purchased.

- Expand store abbreviations into the plain, common grocery name a person would write on a shopping list (e.g. "GV WHL MLK GAL" -> "Whole milk", "ORG BNNA" -> "Bananas", "KS ROMA TOM" -> "Roma tomatoes"). Drop brand names unless the brand is the product.
- quantity is the number of units bought (use 1 when unclear; for items sold by weight use 1).
- Merge duplicate lines of the same product by adding their quantities.
- Skip anything that isn't a product: subtotals, totals, tax, discounts, coupons, bag fees, deposits, payment and loyalty lines.
- If the image is not a receipt or is unreadable, return an empty list.`;

export async function scanReceipt(file, onProgress) {
  if (getApiKey()) {
    onProgress?.("Reading receipt with Claude…");
    const dataUrl = await resizeImage(file, 2000, 0.85);
    const { items } = await askClaude({
      schema: RECEIPT_SCHEMA,
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: dataUrl.split(",")[1] } },
        { type: "text", text: RECEIPT_PROMPT },
      ],
    });
    return items;
  }
  return ocrReceipt(file, onProgress);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Couldn't load the scanner. Check your connection."));
    document.head.appendChild(s);
  });
}

const NOT_ITEMS = /(sub\s*total|total|tax|change|cash|visa|mastercard|amex|debit|credit|balance|savings|saved|discount|coupon|member|rewards|points|tender|payment|approved|auth|card|bag fee|deposit|thank|receipt|store|cashier|register|items? sold|tel|phone|www|http|date|time)/i;

async function ocrReceipt(file, onProgress) {
  onProgress?.("Loading scanner…");
  await loadScript(TESSERACT_URL);
  const worker = await window.Tesseract.createWorker("eng", 1, {
    logger: (m) => m.status === "recognizing text" && onProgress?.(`Reading receipt… ${Math.round(m.progress * 100)}%`),
  });
  try {
    const dataUrl = await resizeImage(file, 2000, 0.9);
    const { data } = await worker.recognize(dataUrl);
    const items = [];
    for (const raw of data.text.split("\n")) {
      const line = raw.trim();
      if (!/\d+[.,]\d{2}/.test(line) || NOT_ITEMS.test(line)) continue; // item lines end in a price
      let qty = 1;
      const q = line.match(/(\d+)\s*@/) || line.match(/^(\d{1,2})\s+[a-z]/i);
      if (q) qty = Math.max(1, Math.min(24, parseInt(q[1], 10)));
      const name = line
        .replace(/\d+\s*@.*$/, "")
        .replace(/-?\$?\d+[.,]\d{2}.*$/, "") // price and anything after it
        .replace(/^\d+\s+/, "")
        .replace(/\b\d{4,}\b/g, "") // item codes
        .replace(/[^a-z\s&'-]/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (name.length < 3) continue;
      items.push({ name: name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), quantity: qty, category: "" });
    }
    return items;
  } finally {
    worker.terminate();
  }
}

// ---------- recipe import from a link ----------

const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    cuisine: { type: "string" },
    time: { type: "string" },
    servings: { type: "string" },
    image_url: { type: "string" },
    ingredients: { type: "array", items: { type: "string" } },
    steps: { type: "array", items: { type: "string" } },
  },
  required: ["title", "cuisine", "time", "servings", "image_url", "ingredients", "steps"],
  additionalProperties: false,
};

export async function importRecipe(url, cuisines) {
  return askClaude({
    schema: RECIPE_SCHEMA,
    tools: [{ type: "web_fetch_20260209", name: "web_fetch", max_uses: 3 }],
    content: `Fetch this recipe page and extract the recipe: ${url}

- cuisine: pick the best fit from ${cuisines.join(", ")} (or another single word if none fit).
- time: total time, short (e.g. "35 min"); "" if not given. servings: e.g. "4"; "" if not given.
- image_url: the main photo of the finished dish (og:image is ideal), as an absolute URL; "" if none.
- ingredients: one string per ingredient exactly as written with amounts (e.g. "2 cups basmati rice"). Append " (optional)" to optional ones.
- steps: the instructions, one string per step, without step numbers.`,
  });
}
